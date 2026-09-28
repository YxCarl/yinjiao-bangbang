const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createGetMessagesHandler } = require('../cloudfunctions/getMessages/handler')
const { createGetConversationsHandler } = require('../cloudfunctions/getConversations/handler')
const { createCloudDatabaseAdapter: messagesAdapter } = require('../cloudfunctions/getMessages/cloud-database-adapter')
const { createCloudDatabaseAdapter: conversationsAdapter } = require('../cloudfunctions/getConversations/cloud-database-adapter')
const { InMemoryMessageDatabase } = require('./in-memory-message-database')
const { loadMessagePage } = require('../utils/message-history')
const { loadConversationPage } = require('../utils/conversation-list')

const time = '2026-09-26T00:00:00.000Z'
const logger = { error() {} }
const row = index => ({
  _id: `message_${String(index).padStart(4, '0')}`, _openid: 'student',
  conversationId: 'order_example', createTime: time, content: `entry ${index}`, kind: 'text'
})
function database() {
  return new InMemoryMessageDatabase({
    users: [{ _id: 'mentor-profile', _openid: 'mentor', role: 'mentor', mentorStatus: 'approved' }],
    orders: [{ _id: 'example', _openid: 'student', teacherId: 'mentor-profile', status: 1 }],
    messages: Array.from({ length: 123 }, (_, index) => row(index))
  })
}
function reader(db, openid = 'mentor') {
  return createGetMessagesHandler({ getOpenid: async () => openid, database: db, logger })
}
function conversations(db, openid = 'student') {
  return createGetConversationsHandler({ getOpenid: async () => openid, database: db, logger })
}

test('older pages retain all tied timestamps without duplicate IDs while newer messages arrive', async () => {
  const db = database()
  const read = reader(db)
  const first = await read({ conversationId: 'order_example' })
  assert.equal(first.data.length, 50)
  assert.equal(first.hasMore, true)
  db.messages.push({ ...row(999), createTime: '2026-09-26T01:00:00.000Z' })
  const second = await read({ conversationId: 'order_example', cursor: first.nextCursor })
  const third = await read({ conversationId: 'order_example', cursor: second.nextCursor })
  assert.equal(second.data.length, 50)
  assert.equal(third.data.length, 23)
  assert.equal(third.hasMore, false)
  assert.equal(third.nextCursor, '')
  const ids = third.data.concat(second.data, first.data).map(item => item._id)
  assert.deepEqual(ids, Array.from({ length: 123 }, (_, index) => row(index)._id))
})

test('incremental polling pages through more than 50 new messages without skipping a middle batch', async () => {
  const db = database()
  const read = reader(db)
  const first = await read({ conversationId: 'order_example' })
  db.messages.push(...Array.from({ length: 120 }, (_, index) => ({
    ...row(index + 123), createTime: '2026-09-26T01:00:00.000Z'
  })))
  let cursor = first.latestCursor
  const ids = []
  for (let page = 0; page < 3; page += 1) {
    const result = await read({ conversationId: 'order_example', direction: 'after', cursor })
    assert.equal(result.code, 0)
    ids.push(...result.data.map(item => item._id))
    cursor = result.latestCursor
    assert.equal(result.hasMore, page < 2)
  }
  assert.deepEqual(ids, Array.from({ length: 120 }, (_, index) => row(index + 123)._id))
})

test('each history page rechecks permissions and rejects cross-conversation and malformed cursors', async () => {
  const db = database()
  const read = reader(db)
  const first = await read({ conversationId: 'order_example' })
  assert.equal((await read({ conversationId: 'another', cursor: first.nextCursor })).code, -1)
  for (const event of [
    { cursor: 'bad!' }, { limit: 51 }, { limit: 0 }, { limit: '10' },
    { direction: 'after' }, { direction: 'invalid' }, { cursor: {} }
  ]) assert.equal((await read({ conversationId: 'order_example', ...event })).code, -1)
  db.users[0].mentorStatus = 'revoked'
  assert.equal((await read({ conversationId: 'order_example', cursor: first.nextCursor })).code, -3)
})

test('a continuation cursor reaches a valid conversation after more than 200 stale memberships', async () => {
  const db = database()
  db.orders[0].anonymous = true
  db.conversations = Array.from({ length: 210 }, (_, index) => ({
    _id: `stale_${String(index).padStart(4, '0')}`, _openid: 'mentor',
    conversationId: `order_missing_${index}`, lastTime: '2026-09-26T01:00:00.000Z'
  }))
  db.conversations.push({
    _id: 'older_valid', _openid: 'mentor', conversationId: 'order_example',
    peerName: 'private name', lastTime: time
  })
  const read = conversations(db, 'mentor')
  const first = await read()
  assert.equal(first.data.length, 0)
  assert.equal(first.scanLimitReached, true)
  assert.equal(first.hasMore, true)
  const next = await read({ cursor: first.nextCursor })
  assert.equal(next.data.length, 1)
  assert.equal(next.data[0].peerName, '匿名学员')
  assert.equal(next.hasMore, false)
  assert.equal((await conversations(db)({ cursor: first.nextCursor })).code, -1)
})

test('small conversation pages advance only past consumed records with tied timestamps', async () => {
  const db = database()
  db.conversations = Array.from({ length: 7 }, (_, index) => ({
    _id: `conv_${index}`, _openid: 'student', conversationId: `general_${index}`, lastTime: time
  }))
  const read = conversations(db)
  const all = []
  let cursor
  for (let count = 0; count < 4; count += 1) {
    const result = await read({ limit: 2, cursor })
    all.push(...result.data.map(item => item._id))
    cursor = result.nextCursor
  }
  assert.deepEqual(all, ['conv_6', 'conv_5', 'conv_4', 'conv_3', 'conv_2', 'conv_1', 'conv_0'])
  assert.equal(cursor, '')
})

test('database cursors scope range queries and use native Date plus ID as the tie breaker', async () => {
  const calls = []
  const command = Object.fromEntries(['and', 'or', 'lt', 'gt'].map(name => [name, (...values) => ({ [name]: values })]))
  const query = {
    where(value) { calls.push(value); return this }, orderBy() { return this },
    limit() { return this }, async get() { return { data: [] } }
  }
  const db = { command, collection() { return query } }
  await messagesAdapter(db).listMessages('order_example', { cursor: { time: Date.parse(time), id: 'message_0050' }, direction: 'after' })
  assert.deepEqual(calls[0].and[0], { conversationId: 'order_example' })
  assert.deepEqual(calls[0].and[1].or[0], { createTime: { gt: [new Date(time)] } })
  assert.deepEqual(calls[0].and[1].or[1], { createTime: new Date(time), _id: { gt: ['message_0050'] } })
  await conversationsAdapter(db).listConversations('student', { cursor: { time: Date.parse(time), id: 'conv_0050' } })
  assert.deepEqual(calls[1].and[0], { _openid: 'student' })
  assert.deepEqual(calls[1].and[1].or[1], { lastTime: new Date(time), _id: { lt: ['conv_0050'] } })
})

test('client history preserves older pages, deduplicates IDs, and clears revoked content', () => {
  const requests = []
  const wx = { cloud: { callFunction(request) { requests.push(request) } } }
  const page = { data: { conversationId: 'order_example', messages: [] }, setData(patch) { Object.assign(this.data, patch) } }
  loadMessagePage(page, wx, 'messages')
  requests.shift().success({ result: { code: 0, data: [row(2), row(3)], latestCursor: 'latest', nextCursor: 'older', hasMore: true } })
  loadMessagePage(page, wx, 'messages', 'older')
  const older = requests.shift()
  assert.equal(older.data.cursor, 'older')
  older.success({ result: { code: 0, data: [row(0), row(1), row(2)], hasMore: false } })
  assert.deepEqual(page.data.messages.map(item => item.id), [0, 1, 2, 3].map(index => row(index)._id))
  loadMessagePage(page, wx, 'messages')
  const poll = requests.shift()
  assert.equal(poll.data.cursor, 'latest')
  assert.equal(poll.data.direction, 'after')
  poll.success({ result: { code: 0, data: [row(4)], latestCursor: 'new-latest' } })
  assert.equal(page.data.messages.length, 5)
  loadMessagePage(page, wx, 'messages')
  requests.shift().success({ result: { code: -3 } })
  assert.equal(page.data.messages.length, 0)
  assert.equal(page.data.hasOlder, false)
})

test('conversation client continues empty scan pages and ignores late refresh responses', () => {
  const requests = []
  const wx = { cloud: { callFunction(request) { requests.push(request) } }, showToast() {} }
  const page = { data: { conversations: [] }, _formatTime() { return '' }, setData(patch) { Object.assign(this.data, patch) } }
  loadConversationPage(page, wx)
  requests.shift().success({ result: { code: 0, data: [], scanLimitReached: true, hasMore: true, nextCursor: 'continue' } })
  assert.equal(page.data.hasMoreConversations, true)
  loadConversationPage(page, wx, true)
  const stale = requests.shift()
  assert.equal(stale.data.cursor, 'continue')
  loadConversationPage(page, wx)
  requests.shift().success({ result: { code: 0, data: [], hasMore: false } })
  stale.success({ result: { code: 0, data: [{ _id: 'stale', conversationId: 'old', lastTime: time }] } })
  assert.equal(page.data.conversations.length, 0)
})

test('periodic head reconciliation recovers a late same-timestamp lower ID', async () => {
  const db = database()
  db.messages = [row(50)]
  const read = reader(db)
  const requests = []
  const wx = { cloud: { callFunction(request) { requests.push(request) } } }
  const page = { data: { conversationId: 'order_example', messages: [] }, setData(patch) { Object.assign(this.data, patch) } }
  async function load(mode) {
    loadMessagePage(page, wx, 'messages', mode)
    const request = requests.shift()
    request.success({ result: await read(request.data) })
    return request.data
  }
  await load()
  db.messages.push(row(49)) // Committed later, but sorts behind the forward cursor.
  for (let index = 0; index < 10; index += 1) assert.equal((await load()).direction, 'after')
  assert.equal(page.data.messages.length, 1)
  assert.equal((await load()).cursor, undefined)
  assert.deepEqual(page.data.messages.map(item => item.id), [row(49)._id, row(50)._id])
})

test('manual head refresh never advances past an unconsumed forward backlog', async () => {
  const db = database()
  db.messages = [row(0)]
  const read = reader(db)
  const requests = []
  const wx = { cloud: { callFunction(request) { requests.push(request) } } }
  const page = { data: { conversationId: 'order_example', messages: [] }, setData(patch) { Object.assign(this.data, patch) } }
  async function load(mode) {
    loadMessagePage(page, wx, 'messages', mode)
    const request = requests.shift()
    request.success({ result: await read(request.data) })
  }
  await load()
  const frontier = page._messagePaging.latest
  db.messages.push(...Array.from({ length: 120 }, (_, index) => row(index + 1)))
  await load('refresh')
  assert.equal(page._messagePaging.latest, frontier)
  for (let index = 0; index < 3; index += 1) await load()
  assert.deepEqual(page.data.messages.map(item => item.id), Array.from({ length: 121 }, (_, index) => row(index)._id))
})

test('both message views wire stable scroll anchors and an explicit latest refresh', () => {
  for (const name of ['chat', 'teacher-reply']) {
    const markup = fs.readFileSync(path.join(__dirname, '..', 'pages', name, `${name}.wxml`), 'utf8')
    assert.match(markup, /<scroll-view[^>]*scroll-into-view="\{\{messageScrollTarget\}\}"/)
    assert.match(markup, /id="msg-\{\{item.id\}\}"/)
    assert.match(markup, /bindtap="refreshMessages"/)
  }
})
