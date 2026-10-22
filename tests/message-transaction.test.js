const test = require('node:test')
const assert = require('node:assert/strict')
const { TransactionalCloudDatabase } = require('./transactional-cloud-database')
const { createCloudDatabaseAdapter } = require('../cloudfunctions/sendMessage/cloud-database-adapter')
const { createSendMessageHandler } = require('../cloudfunctions/sendMessage/handler')

const time = '2026-10-22T00:00:00.000Z'
function setup() {
  let state = {
    users: [
      { _id: 'mentor', _openid: 'mentor-owner', role: 'mentor', mentorStatus: 'approved' },
      { _id: 'other', _openid: 'other-owner', role: 'mentor', mentorStatus: 'approved' }
    ],
    orders: [{ _id: 'example', _openid: 'student-owner', teacherId: 'mentor', status: 1 }],
    conversations: [
      { _id: 'student-member', _openid: 'student-owner', conversationId: 'order_example', unread: 2, lastMsg: 'before' },
      { _id: 'mentor-member', _openid: 'mentor-owner', conversationId: 'order_example', unread: 3, lastMsg: 'before' }
    ],
    messages: [], rateLimits: []
  }
  const db = new TransactionalCloudDatabase(() => state, value => { state = value }, () => time)
  const adapter = createCloudDatabaseAdapter(db)
  const send = owner => createSendMessageHandler({
    getOpenid: () => owner, now: () => Date.parse(time), database: adapter, logger: { error() {} }
  })
  return { db, adapter, send, state: () => state }
}
const event = { conversationId: 'order_example', requestId: 'transaction_test_0001', kind: 'text', content: 'synthetic message' }

test('message transaction rejects mentor approval revoked after the handler precheck', async () => {
  const fixture = setup()
  fixture.db.beforeTransaction = () => { fixture.state().users[0].mentorStatus = 'revoked' }
  const result = await fixture.send('mentor-owner')(event)
  assert.equal(result.code, -3)
  assert.equal(fixture.state().messages.length, 0)
  assert.equal(fixture.state().rateLimits.length, 0)
  assert.ok(fixture.state().conversations.every(item => item.lastMsg === 'before'))
})

test('message transaction rejects an order reassigned after the handler precheck', async () => {
  const fixture = setup()
  fixture.db.beforeTransaction = () => { fixture.state().orders[0].teacherId = 'other' }
  assert.equal((await fixture.send('mentor-owner')(event)).code, -3)
  assert.equal(fixture.state().messages.length, 0)
})

test('transaction revalidates sender membership identity, existence and conversation', async () => {
  for (const mutate of [
    state => { state.conversations[0]._openid = 'outsider' },
    state => { state.conversations[0].conversationId = 'unrelated' },
    state => { state.conversations.shift() },
    state => { state.orders = [] },
    state => { state.orders[0]._openid = 'new-owner' }
  ]) {
    const fixture = setup()
    fixture.db.beforeTransaction = () => mutate(fixture.state())
    assert.equal((await fixture.send('student-owner')(event)).code, -3)
    assert.equal(fixture.state().messages.length, 0)
    assert.equal(fixture.state().rateLimits.length, 0)
  }
})

test('student sends do not update a peer revoked or replaced before the transaction', async () => {
  for (const mutate of [
    state => { state.users[0].mentorStatus = 'revoked' },
    state => { state.orders[0].teacherId = 'other' },
    state => { state.conversations[1]._openid = 'outsider' },
    state => { state.conversations[1].conversationId = 'unrelated' }
  ]) {
    const fixture = setup()
    fixture.db.beforeTransaction = () => mutate(fixture.state())
    assert.equal((await fixture.send('student-owner')(event)).code, 0)
    assert.equal(fixture.state().conversations[1].unread, 3)
    assert.equal(fixture.state().conversations[1].lastMsg, 'before')
    assert.equal(fixture.state().messages.length, 1)
  }
})

test('the real send adapter commits once, preserves replay and rolls back every write failure', async () => {
  const fixture = setup()
  const send = fixture.send('student-owner')
  assert.equal((await send(event)).code, 0)
  assert.equal((await send(event)).data.duplicate, true)
  assert.equal(fixture.state().messages.length, 1)
  assert.equal(fixture.state().rateLimits[0].count, 1)
  assert.equal(fixture.state().conversations[1].unread, 4)
  for (let write = 1; write <= 4; write += 1) {
    const failed = setup()
    const before = structuredClone(failed.state())
    failed.db.failOnWrite = write
    assert.equal((await failed.send('student-owner')(event)).code, -1)
    assert.deepEqual(failed.state(), before)
  }
})

test('general conversations still require a valid membership at transaction time', async () => {
  const fixture = setup()
  fixture.state().conversations.forEach(item => { item.conversationId = 'general' })
  fixture.db.beforeTransaction = () => { fixture.state().conversations[0]._openid = 'outsider' }
  assert.equal((await fixture.send('student-owner')({ ...event, conversationId: 'general' })).code, -3)
  assert.equal(fixture.state().messages.length, 0)
})

test('an idempotent replay still rechecks approval at commit time', async () => {
  const fixture = setup()
  const send = fixture.send('mentor-owner')
  assert.equal((await send(event)).code, 0)
  const before = structuredClone(fixture.state())
  fixture.db.beforeTransaction = () => { fixture.state().users[0].mentorStatus = 'revoked' }
  assert.equal((await send(event)).code, -3)
  assert.deepEqual(fixture.state().messages, before.messages)
  assert.deepEqual(fixture.state().rateLimits, before.rateLimits)
  assert.deepEqual(fixture.state().conversations, before.conversations)
})
