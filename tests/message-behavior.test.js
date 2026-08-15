const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createGetConversationsHandler } = require('../cloudfunctions/getConversations/handler')
const { createGetMessagesHandler } = require('../cloudfunctions/getMessages/handler')
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

  assert.equal((await sendMessage(database, 'mentor-openid')({
    conversationId: orderConversation,
    kind: 'voice',
    content: '客户端不可控制此文本',
    fileID: 'cloud://example-env.voice/chat/new.mp3',
    dur: 60
  })).code, 0)

  const voice = database.snapshot().messages.at(-1)
  assert.equal(voice.kind, 'voice')
  assert.equal(voice.dur, 60)
  assert.equal(voice.content, '语音 60 秒')
  assert.equal(voice.fileID, 'cloud://example-env.voice/chat/new.mp3')
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

test('the chat page sends request IDs and retries once with the same payload', () => {
  const page = fs.readFileSync(path.join(root, 'pages', 'chat', 'chat.js'), 'utf8')
  assert.match(page, /createRequestId\('message'\)/)
  assert.match(page, /_callSendMessage\(payload, retryCount \+ 1\)/)
  assert.match(page, /data: payload/)
})
