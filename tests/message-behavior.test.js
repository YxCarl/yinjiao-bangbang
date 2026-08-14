const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createGetConversationsHandler } = require('../cloudfunctions/getConversations/handler')
const { createGetMessagesHandler } = require('../cloudfunctions/getMessages/handler')
const { createSendMessageHandler } = require('../cloudfunctions/sendMessage/handler')
const { InMemoryMessageDatabase } = require('./in-memory-message-database')

const root = path.resolve(__dirname, '..')
const silentLogger = { error() {} }
const orderConversation = 'order_order-1'

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
  return createSendMessageHandler({
    getOpenid: async () => openid,
    database: database,
    logger: silentLogger
  })
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
    assert.match(source, /createCloudDatabaseAdapter\(cloud\.database\(\)\)/)
  }
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

test('read receipts and voice metadata are normalized after authorization', async () => {
  const database = new InMemoryMessageDatabase(fixtures())

  assert.equal((await sendMessage(database, 'mentor-openid')({
    conversationId: orderConversation,
    kind: '_read'
  })).code, 0)
  assert.equal(
    database.snapshot().conversations.find(item => item._id === 'mentor-conversation').unread,
    0
  )

  assert.equal((await sendMessage(database, 'mentor-openid')({
    conversationId: orderConversation,
    kind: 'voice',
    content: '语音 90 秒',
    fileID: 'cloud://example-env.voice/new.mp3',
    dur: 90
  })).code, 0)

  const voice = database.snapshot().messages.at(-1)
  assert.equal(voice.kind, 'voice')
  assert.equal(voice.dur, 60)
  assert.equal(voice.fileID, 'cloud://example-env.voice/new.mp3')
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
