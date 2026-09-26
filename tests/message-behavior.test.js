const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createGetConversationsHandler } = require('../cloudfunctions/getConversations/handler')
const { createCloudDatabaseAdapter: createConversationsCloudAdapter } = require('../cloudfunctions/getConversations/cloud-database-adapter')
const { createGetMessagesHandler } = require('../cloudfunctions/getMessages/handler')
const { createCloudDatabaseAdapter: createMessagesCloudAdapter } = require('../cloudfunctions/getMessages/cloud-database-adapter')
const { createSendMessageHandler } = require('../cloudfunctions/sendMessage/handler')
const { createMessageId } = require('../cloudfunctions/sendMessage/policy')
const { InMemoryMessageDatabase } = require('./in-memory-message-database')

const root = path.resolve(__dirname, '..')
const silentLogger = { error() {} }
const orderConversation = 'order_order-1'
let messageRequestSequence = 0

function fixtures() {
  return {
    clock: '2026-08-14T12:00:00.000Z',
    users: [
      { _id: 'student-profile', _openid: 'student-openid', role: 'student' },
      {
        _id: 'mentor-profile',
        _openid: 'mentor-openid',
        role: 'mentor',
        mentorStatus: 'approved'
      },
      {
        _id: 'other-mentor-profile',
        _openid: 'other-mentor-openid',
        role: 'mentor',
        mentorStatus: 'approved'
      },
      {
        _id: 'pending-profile',
        _openid: 'pending-openid',
        role: 'student',
        mentorStatus: 'pending'
      },
      {
        _id: 'revoked-profile',
        _openid: 'revoked-openid',
        role: 'mentor',
        mentorStatus: 'revoked'
      }
    ],
    orders: [
      {
        _id: 'order-1',
        _openid: 'student-openid',
        teacherId: 'mentor-profile',
        teacher: '李老师',
        student: '张同学',
        title: '教案精修',
        status: 1
      }
    ],
    conversations: [
      {
        _id: 'student-conversation',
        _openid: 'student-openid',
        conversationId: orderConversation,
        participantRole: 'student',
        lastMsg: '已有消息',
        lastTime: '2026-08-14T10:00:00.000Z',
        unread: 1
      },
      {
        _id: 'mentor-conversation',
        _openid: 'mentor-openid',
        conversationId: orderConversation,
        participantRole: 'mentor',
        lastMsg: '已有消息',
        lastTime: '2026-08-14T10:00:00.000Z',
        unread: 2
      },
      {
        _id: 'other-mentor-conversation',
        _openid: 'other-mentor-openid',
        conversationId: orderConversation,
        participantRole: 'mentor',
        lastMsg: '不得更新',
        lastTime: '2026-08-14T10:00:00.000Z',
        unread: 3
      },
      {
        _id: 'pending-conversation',
        _openid: 'pending-openid',
        conversationId: orderConversation,
        participantRole: 'mentor',
        lastMsg: '不得更新',
        lastTime: '2026-08-14T10:00:00.000Z',
        unread: 4
      },
      {
        _id: 'revoked-conversation',
        _openid: 'revoked-openid',
        conversationId: orderConversation,
        participantRole: 'mentor',
        lastMsg: '不得更新',
        lastTime: '2026-08-14T10:00:00.000Z',
        unread: 5
      },
      {
        _id: 'forged-student-conversation',
        _openid: 'outsider-openid',
        conversationId: orderConversation,
        participantRole: 'student',
        lastMsg: '不得更新',
        lastTime: '2026-08-14T10:00:00.000Z',
        unread: 6
      },
      {
        _id: 'general-conversation',
        _openid: 'student-openid',
        conversationId: 'general-1',
        participantRole: 'student',
        lastMsg: '普通会话',
        lastTime: '2026-08-13T10:00:00.000Z',
        unread: 0
      }
    ],
    messages: [
      {
        _id: 'message-1',
        _openid: 'student-openid',
        conversationId: orderConversation,
        kind: 'text',
        content: '老师您好',
        createTime: '2026-08-14T09:00:00.000Z'
      },
      {
        _id: 'message-2',
        _openid: 'mentor-openid',
        conversationId: orderConversation,
        kind: 'voice',
        content: '语音 8 秒',
        fileID: 'cloud://example-env.voice/reply.mp3',
        dur: 8,
        createTime: '2026-08-14T09:05:00.000Z'
      },
      {
        _id: 'message-3',
        _openid: 'student-openid',
        conversationId: 'general-1',
        kind: 'text',
        content: '普通消息',
        createTime: '2026-08-13T09:00:00.000Z'
      }
    ]
  }
}

function getConversations(database, openid) {
  return createGetConversationsHandler({
    getOpenid: async () => openid,
    database: database,
    logger: silentLogger
  })
}

function getMessages(database, openid) {
  return createGetMessagesHandler({
    getOpenid: async () => openid,
    database: database,
    logger: silentLogger
  })
}

function sendMessage(database, openid) {
  const handler = createSendMessageHandler({
    getOpenid: async () => openid,
    now: () => Date.parse(database.clock),
    database: database,
    logger: silentLogger
  })
  return event => handler(Object.assign({
    requestId: `message_request_${String(++messageRequestSequence).padStart(4, '0')}`
  }, event))
}

test('message history returns the newest 50 in chronological display order', async () => {
  const data = fixtures()
  data.messages = Array.from({ length: 70 }, (_, index) => ({
    _id: `message-${index}`,
    _openid: 'student-openid',
    conversationId: orderConversation,
    kind: 'text',
    content: `entry ${index}`,
    createTime: new Date(Date.parse('2026-08-14T09:00:00.000Z') + index * 60000).toISOString()
  }))
  const database = new InMemoryMessageDatabase(data)
  const result = await getMessages(database, 'mentor-openid')({ conversationId: orderConversation })
  assert.equal(result.code, 0)
  assert.equal(result.data.length, 50)
  assert.equal(result.data[0].content, 'entry 20')
  assert.equal(result.data[49].content, 'entry 69')
})

test('CloudBase message query requests the newest bounded page', async () => {
  const calls = []
  const query = {
    where(value) { calls.push(['where', value]); return this },
    orderBy(field, direction) { calls.push(['orderBy', field, direction]); return this },
    limit(value) { calls.push(['limit', value]); return this },
    async get() { return { data: [{ _id: 'new' }, { _id: 'old' }] } }
  }
  const adapter = createMessagesCloudAdapter({ collection() { return query } })
  const result = await adapter.listMessages('order-1')
  assert.deepEqual(calls, [
    ['where', { conversationId: 'order-1' }],
    ['orderBy', 'createTime', 'desc'],
    ['limit', 50]
  ])
  assert.deepEqual(result.map(item => item._id), ['old', 'new'])
})

test('CloudBase conversation query requests a bounded offset page', async () => {
  const calls = []
  const query = {
    where(value) { calls.push(['where', value]); return this },
    orderBy(field, direction) { calls.push(['orderBy', field, direction]); return this },
    skip(value) { calls.push(['skip', value]); return this },
    limit(value) { calls.push(['limit', value]); return this },
    async get() { return { data: [] } }
  }
  const adapter = createConversationsCloudAdapter({ collection() { return query } })
  await adapter.listConversations('mentor-openid', 50, 50)
  assert.deepEqual(calls, [
    ['where', { _openid: 'mentor-openid' }],
    ['orderBy', 'lastTime', 'desc'],
    ['skip', 50],
    ['limit', 50]
  ])
})

test('conversation list bounds work to the newest 50 memberships', async () => {
  const data = fixtures()
  data.conversations = Array.from({ length: 70 }, (_, index) => ({
    _id: `conversation-${index}`,
    _openid: 'student-openid',
    conversationId: `general-${index}`,
    lastTime: new Date(Date.parse('2026-08-14T09:00:00.000Z') + index * 60000).toISOString()
  }))
  const result = await getConversations(new InMemoryMessageDatabase(data), 'student-openid')()
  assert.equal(result.code, 0)
  assert.equal(result.data.length, 50)
  assert.equal(result.data[0].conversationId, 'general-69')
  assert.equal(result.data[49].conversationId, 'general-20')
})

test('conversation list scans past 50 stale memberships and masks a legacy anonymous student', async () => {
  const data = fixtures()
  data.orders[0].typeText = '问诊室'
  data.orders[0].title = '【匿名】教育职场咨询'
  data.conversations = Array.from({ length: 50 }, (_, index) => ({
    _id: `stale-${index}`,
    _openid: 'mentor-openid',
    conversationId: `order_missing-${index}`,
    lastTime: new Date(Date.parse('2026-08-14T12:00:00.000Z') + index * 60000).toISOString()
  }))
  data.conversations.push({
    _id: 'valid-older',
    _openid: 'mentor-openid',
    conversationId: orderConversation,
    peerName: '张同学',
    orderTitle: '【匿名】教育职场咨询',
    lastTime: '2026-08-13T12:00:00.000Z'
  })
  const result = await getConversations(new InMemoryMessageDatabase(data), 'mentor-openid')()
  assert.equal(result.code, 0)
  assert.deepEqual(result.data.map(item => item._id), ['valid-older'])
  assert.equal(result.data[0].peerName, '匿名学员')
  assert.equal(result.data[0].orderTitle, '教育职场咨询')
  assert.equal(result.scanLimitReached, false)
})

test('conversation scan reports when its 200-membership safety cap may hide older valid entries', async () => {
  const data = fixtures()
  data.conversations = Array.from({ length: 200 }, (_, index) => ({
    _id: `stale-${index}`,
    _openid: 'mentor-openid',
    conversationId: `order_missing-${index}`,
    lastTime: new Date(Date.parse('2026-08-14T12:00:00.000Z') + index * 60000).toISOString()
  }))
  const result = await getConversations(new InMemoryMessageDatabase(data), 'mentor-openid')()
  assert.equal(result.code, 0)
  assert.equal(result.data.length, 0)
  assert.equal(result.scanLimitReached, true)
})

test('message entry points export their dependency-injected handlers', () => {
  const expected = {
    getConversations: 'createGetConversationsHandler',
    getMessages: 'createGetMessagesHandler',
    sendMessage: 'createSendMessageHandler'
  }

  for (const [functionName, factoryName] of Object.entries(expected)) {
    const source = fs.readFileSync(
      path.join(root, 'cloudfunctions', functionName, 'index.js'),
      'utf8'
    )
    assert.match(source, new RegExp(`exports\\.main = ${factoryName}\\(`))
    assert.match(source, /createCloudDatabaseAdapter\(cloud\.database\(/)
  }

  const adapter = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'sendMessage', 'cloud-database-adapter.js'),
    'utf8'
  )
  assert.match(adapter, /db\.runTransaction\(/)
  assert.match(adapter, /collection\('rateLimits'\)/)
})

test('order messages require the owner or the assigned approved mentor', async () => {
  const database = new InMemoryMessageDatabase(fixtures())

  for (const openid of [
    'pending-openid',
    'revoked-openid',
    'other-mentor-openid',
    'outsider-openid'
  ]) {
    const result = await getMessages(database, openid)({ conversationId: orderConversation })
    assert.equal(result.code, -3, `${openid} must not inherit access from a stale membership`)
  }

  const studentResult = await getMessages(database, 'student-openid')({
    conversationId: orderConversation
  })
  assert.equal(studentResult.code, 0)
  assert.deepEqual(studentResult.data.map(message => message.side), ['out', 'in'])

  const mentorResult = await getMessages(database, 'mentor-openid')({
    conversationId: orderConversation
  })
  assert.equal(mentorResult.code, 0)
  assert.deepEqual(mentorResult.data.map(message => message.side), ['in', 'out'])
})

test('non-order messages still require an explicit membership', async () => {
  const database = new InMemoryMessageDatabase(fixtures())

  assert.equal((await getMessages(database, 'student-openid')({
    conversationId: 'general-1'
  })).code, 0)
  assert.equal((await getMessages(database, 'outsider-openid')({
    conversationId: 'general-1'
  })).code, -3)
})

test('a malformed order conversation cannot fall back to membership-only access', async () => {
  const data = fixtures()
  data.conversations.push({
    _id: 'malformed-order-membership',
    _openid: 'outsider-openid',
    conversationId: 'order_',
    unread: 0
  })
  const database = new InMemoryMessageDatabase(data)

  assert.equal((await getMessages(database, 'outsider-openid')({
    conversationId: 'order_'
  })).code, -3)
  assert.equal((await sendMessage(database, 'outsider-openid')({
    conversationId: 'order_',
    kind: 'text',
    content: '不应发送'
  })).code, -3)
})

test('conversation lists hide stale, revoked, unassigned, and forged order memberships', async () => {
  const database = new InMemoryMessageDatabase(fixtures())

  const student = await getConversations(database, 'student-openid')()
  assert.deepEqual(
    student.data.map(item => item.conversationId),
    [orderConversation, 'general-1']
  )

  assert.deepEqual(
    (await getConversations(database, 'mentor-openid')()).data.map(item => item.conversationId),
    [orderConversation]
  )

  for (const openid of [
    'pending-openid',
    'revoked-openid',
    'other-mentor-openid',
    'outsider-openid'
  ]) {
    assert.deepEqual((await getConversations(database, openid)()).data, [])
  }
})

test('sending an order message updates only the two currently authorized participants', async () => {
  const database = new InMemoryMessageDatabase(fixtures())
  const before = database.snapshot()

  const denied = await sendMessage(database, 'other-mentor-openid')({
    conversationId: orderConversation,
    kind: 'text',
    content: '不应发送'
  })
  assert.equal(denied.code, -3)
  assert.equal(database.snapshot().messages.length, before.messages.length)

  const result = await sendMessage(database, 'student-openid')({
    conversationId: orderConversation,
    kind: 'text',
    content: '  明天见  '
  })
  assert.equal(result.code, 0)

  const state = database.snapshot()
  assert.equal(state.messages.at(-1).content, '明天见')
  assert.equal(state.messages.at(-1)._openid, 'student-openid')

  const memberships = Object.fromEntries(
    state.conversations
      .filter(item => item.conversationId === orderConversation)
      .map(item => [item._openid, item])
  )
  assert.equal(memberships['student-openid'].lastMsg, '明天见')
  assert.equal(memberships['mentor-openid'].lastMsg, '明天见')
  assert.equal(memberships['mentor-openid'].unread, 3)
  assert.equal(memberships['other-mentor-openid'].lastMsg, '不得更新')
  assert.equal(memberships['pending-openid'].lastMsg, '不得更新')
  assert.equal(memberships['revoked-openid'].lastMsg, '不得更新')
  assert.equal(memberships['outsider-openid'].lastMsg, '不得更新')
})

test('read receipts and voice metadata fail closed or normalize after authorization', async () => {
  const database = new InMemoryMessageDatabase(fixtures())

  assert.equal((await sendMessage(database, 'mentor-openid')({
    conversationId: orderConversation,
    kind: '_read'
  })).code, 0)
  assert.equal(
    database.snapshot().conversations.find(item => item._id === 'mentor-conversation').unread,
    0
  )

  const beforeVoice = database.snapshot().messages.length
  assert.equal((await sendMessage(database, 'mentor-openid')({
    conversationId: orderConversation,
    kind: 'voice',
    content: '语音 90 秒',
    fileID: 'cloud://example-env.voice/chat/new.mp3',
    dur: 90
  })).code, -1)
  assert.equal(database.snapshot().messages.length, beforeVoice)

  const voiceHandler = sendMessage(database, 'mentor-openid')
  const voiceRequestId = 'message_voice_0001'
  const prepared = await voiceHandler({
    action: 'prepare_voice',
    requestId: voiceRequestId,
    conversationId: orderConversation
  })
  assert.equal(prepared.code, 0)
  assert.equal((await voiceHandler({
    requestId: voiceRequestId,
    conversationId: orderConversation,
    kind: 'voice',
    fileID: 'cloud://example-env.voice/chat/unrelated.mp3',
    dur: 60
  })).code, -3)

  assert.equal((await voiceHandler({
    requestId: voiceRequestId,
    conversationId: orderConversation,
    kind: 'voice',
    content: '客户端不可控制此文本',
    fileID: `cloud://example-env.voice/${prepared.data.cloudPath}`,
    dur: 60
  })).code, 0)

  const voice = database.snapshot().messages.at(-1)
  assert.equal(voice.kind, 'voice')
  assert.equal(voice.dur, 60)
  assert.equal(voice.content, '语音 60 秒')
  assert.equal(voice.fileID, `cloud://example-env.voice/${prepared.data.cloudPath}`)
})

test('message retries are idempotent and increment unread only once', async () => {
  const database = new InMemoryMessageDatabase(fixtures())
  const handler = sendMessage(database, 'student-openid')
  const event = {
    requestId: 'message_retry_0001',
    conversationId: orderConversation,
    kind: 'text',
    content: '只发送一次'
  }
  const before = database.snapshot()
  const first = await handler(event)
  const replay = await handler(event)
  const after = database.snapshot()

  assert.equal(first.code, 0)
  assert.equal(first.data.duplicate, false)
  assert.equal(replay.code, 0)
  assert.equal(replay.data.duplicate, true)
  assert.equal(after.messages.length, before.messages.length + 1)
  assert.equal(after.rateLimits[0].count, 1)
  assert.equal(
    after.conversations.find(item => item._id === 'mentor-conversation').unread,
    before.conversations.find(item => item._id === 'mentor-conversation').unread + 1
  )
})

test('message IDs are deterministic per caller without exposing OPENID', () => {
  const requestId = 'message_identity_0001'
  const ownerId = createMessageId('student-openid', requestId)
  assert.equal(ownerId, createMessageId('student-openid', requestId))
  assert.notEqual(ownerId, createMessageId('outsider-openid', requestId))
  assert.doesNotMatch(ownerId, /student-openid/)
})

test('message sending rejects invalid requests and the thirty-first message per minute', async () => {
  const database = new InMemoryMessageDatabase(fixtures())
  const handler = sendMessage(database, 'student-openid')

  assert.equal((await handler({
    requestId: '',
    conversationId: orderConversation,
    kind: 'text',
    content: '缺少请求标识'
  })).code, -1)
  assert.equal((await handler({
    conversationId: orderConversation,
    kind: 'voice',
    content: '伪造语音',
    fileID: 'cloud://example-env.voice/orders/not-chat.mp3',
    dur: 3
  })).code, -1)

  for (let index = 0; index < 30; index += 1) {
    const result = await handler({
      requestId: `message_rate_${String(index).padStart(4, '0')}`,
      conversationId: orderConversation,
      kind: 'text',
      content: `消息 ${index}`
    })
    assert.equal(result.code, 0)
  }
  assert.equal((await handler({
    requestId: 'message_rate_0030',
    conversationId: orderConversation,
    kind: 'text',
    content: '超出频率'
  })).code, -4)
  assert.equal(database.snapshot().rateLimits[0].count, 30)
})

test('an order owner can recreate a missing membership without granting outsiders access', async () => {
  const data = fixtures()
  data.conversations = data.conversations.filter(item => item._openid !== 'student-openid')
  const database = new InMemoryMessageDatabase(data)

  const result = await sendMessage(database, 'student-openid')({
    conversationId: orderConversation,
    kind: 'text',
    content: '重新建立会话'
  })
  assert.equal(result.code, 0)
  assert.ok(await database.getMembership('student-openid', orderConversation))

  assert.equal((await sendMessage(database, 'outsider-openid')({
    conversationId: orderConversation,
    kind: 'text',
    content: '仍然禁止'
  })).code, -3)
})

test('both messaging pages send request IDs and retry once with the same payload', () => {
  for (const pageName of ['chat', 'teacher-reply']) {
    const page = fs.readFileSync(
      path.join(root, 'pages', pageName, `${pageName}.js`),
      'utf8'
    )
    assert.match(page, /createRequestId\('message'\)/)
    assert.match(page, /_callSendMessage\(payload, retryCount \+ 1\)/)
    assert.match(page, /data: payload/)
    assert.match(page, /action: 'prepare_voice'/)
    assert.match(page, /cloudPath: cloudPath/)
  }
})
