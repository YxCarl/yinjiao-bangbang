const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const { buildDemoFixtures, toExtendedJson, writeFixtures, PREFIX } = require('../scripts/generate-demo-fixtures')
const { createGetOrdersHandler } = require('../cloudfunctions/getOrders/handler')
const { createGetMessagesHandler } = require('../cloudfunctions/getMessages/handler')
const { InMemoryOrderDatabase } = require('./in-memory-order-database')
const { InMemoryMessageDatabase } = require('./in-memory-message-database')

test('demo fixtures are deterministic, internally linked and limited to synthetic records', () => {
  const data = buildDemoFixtures()
  assert.deepEqual(data, buildDemoFixtures())
  const users = new Map(data.users.map(user => [user._id, user]))
  const orders = new Map(data.orders.map(order => [order._id, order]))
  for (const [name, records] of Object.entries(data)) {
    for (const record of records) {
      assert.ok(record._id.startsWith(PREFIX), `${name} is outside the reset namespace`)
      assert.equal(record.fixtureSet, PREFIX)
      if (record._openid) assert.ok(record._openid.startsWith('SYNTHETIC_ONLY_'))
    }
    assert.equal(new Set(records.map(record => record._id)).size, records.length)
  }
  for (const order of data.orders) {
    assert.equal(users.get(order.studentId)._openid, order._openid)
    if (order.teacherId) assert.equal(users.get(order.teacherId).mentorStatus, 'approved')
    if (order.anonymous) assert.equal(order.student, '匿名学员')
  }
  for (const conversation of data.conversations) {
    const order = orders.get(conversation.conversationId.slice('order_'.length))
    assert.ok(order)
    const openid = conversation.participantRole === 'student' ? order._openid : users.get(order.teacherId)._openid
    assert.equal(conversation._openid, openid)
  }
  assert.ok(data.messages.length > 50)
  assert.ok(data.conversations.filter(item => item._openid === 'SYNTHETIC_ONLY_student').length > 50)
  assert.deepEqual(data.aiTasks, [])
  assert.deepEqual(data.rateLimits, [])
  assert.doesNotMatch(JSON.stringify(data), /cloud:\/\/|https:\/\/|BEGIN .*PRIVATE KEY/)
})

test('fixture dates export as Extended JSON while private actor bindings remain consistent', () => {
  const data = buildDemoFixtures({ student: 'private-test-student', mentor: 'private-test-mentor' })
  assert.equal(data.users.find(user => user._id === PREFIX + 'student')._openid, 'private-test-student')
  assert.equal(data.orders.find(order => order._id === PREFIX + 'open_question')._openid, 'private-test-student')
  const exported = toExtendedJson(data)
  assert.deepEqual(exported.messages[0].createTime, { $date: '2026-09-26T08:05:00.000Z' })
  assert.throws(() => buildDemoFixtures({ student: 'same', mentor: 'same' }), /different identities/)
  assert.throws(() => buildDemoFixtures({ unknown: 'x' }), /Unknown actor/)
  assert.throws(() => writeFixtures(path.resolve(__dirname, '..'), data), /new child directory/)
})

test('private bindings and generated fixtures are excluded from both Git and Mini Program packaging', () => {
  const root = path.resolve(__dirname, '..')
  const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
  const ignored = config.packOptions.ignore.filter(item => item.type === 'folder').map(item => item.value)
  for (const folder of ['secrets', 'outputs']) assert.ok(ignored.includes(folder))
  const paths = ['secrets/demo-bindings.json', 'outputs/demo-fixtures-v1/users.jsonl']
  const gitIgnored = execFileSync('git', ['check-ignore', '--no-index', ...paths], { cwd: root, encoding: 'utf8' })
  for (const file of paths) assert.ok(gitIgnored.includes(file))
})

test('generated fixtures exercise mentor isolation, name masking and multiple history pages', async () => {
  const data = buildDemoFixtures()
  const orders = createGetOrdersHandler({
    getOpenid: async () => 'SYNTHETIC_ONLY_mentor', database: new InMemoryOrderDatabase(data), logger: { error() {} }
  })
  const result = await orders({ scope: 'all' })
  assert.equal(result.code, 0)
  assert.equal(result.data.some(order => order._id === PREFIX + 'other_mentor_question'), false)
  assert.equal(result.data.find(order => order._id === PREFIX + 'anonymous_question').student, '匿名学员')

  const read = createGetMessagesHandler({
    getOpenid: async () => 'SYNTHETIC_ONLY_mentor', database: new InMemoryMessageDatabase(data), logger: { error() {} }
  })
  const conversationId = 'order_' + PREFIX + 'anonymous_question'
  const first = await read({ conversationId })
  const second = await read({ conversationId, cursor: first.nextCursor })
  assert.equal(first.data.length, 50)
  assert.equal(second.data.length, 15)
  assert.equal(new Set(first.data.concat(second.data).map(message => message._id)).size, 65)
})
