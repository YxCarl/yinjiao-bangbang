const {
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW_MS,
  cloudFileMatchesVoicePath,
  createMessageId,
  createMessageRateLimitId,
  normalizeConversationId,
  normalizeMessage,
  validateRequestId,
  voicePathForMessage
} = require('./policy')

function orderIdFromConversation(conversationId) {
  if (!conversationId.startsWith('order_')) return ''
  return conversationId.slice('order_'.length)
}

async function resolveOrderAccess(database, openid, orderId) {
  if (!orderId) return null

  const order = await database.getOrder(orderId)
  if (!order) return null
  if (order._openid === openid) {
    const assignedMentor = order.teacherId
      ? await database.getUser(order.teacherId)
      : null
    const peerOpenids = assignedMentor &&
      assignedMentor.role === 'mentor' &&
      assignedMentor.mentorStatus === 'approved' &&
      assignedMentor._openid
      ? [assignedMentor._openid]
      : []
    return {
      participantRole: 'student',
      peerName: order.teacher || '导师',
      orderTitle: order.title || '',
      peerOpenids: peerOpenids
    }
  }

  const mentor = await database.findApprovedMentor(openid)
  if (!mentor || mentor._id !== order.teacherId) return null
  const anonymous = order.anonymous === true ||
    (order.typeText === '问诊室' && typeof order.title === 'string' && order.title.startsWith('【匿名】'))
  return {
    participantRole: 'mentor',
    peerName: anonymous ? '匿名学员' : (order.student || '学员'),
    orderTitle: order.title || '',
    peerOpenids: order._openid ? [order._openid] : []
  }
}

function createSendMessageHandler(dependencies) {
  const { getOpenid, now, database, logger } = dependencies

  return async function sendMessage(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const conversationId = normalizeConversationId(event.conversationId)
    if (!conversationId) return { code: -1, error: '参数错误' }

    try {
      let membership = await database.getMembership(openid, conversationId)
      const isOrderConversation = conversationId.startsWith('order_')
      const orderId = orderIdFromConversation(conversationId)
      const orderAccess = isOrderConversation
        ? await resolveOrderAccess(database, openid, orderId)
        : null

      if (isOrderConversation && !orderAccess) {
        return { code: -3, error: '无权访问此会话' }
      }
      if (!isOrderConversation && !membership) {
        return { code: -3, error: '无权访问此会话' }
      }

      if (!membership && orderAccess) {
        membership = await database.createMembership(openid, conversationId, orderAccess)
      }

      if (event.kind === '_read') {
        await database.markMembershipRead(membership._id)
        return { code: 0 }
      }

      if (event.action === 'prepare_voice') {
        const requestId = validateRequestId(event.requestId)
        if (!requestId) return { code: -1, error: '消息请求标识无效，请更新小程序后重试' }
        const messageId = createMessageId(openid, requestId)
        return {
          code: 0,
          data: { messageId: messageId, cloudPath: voicePathForMessage(messageId) }
        }
      }

      const normalized = normalizeMessage(event)
      if (!normalized.ok) return { code: -1, error: normalized.error }

      const timestamp = now()
      const windowStartMs = Math.floor(timestamp / MESSAGE_RATE_WINDOW_MS) * MESSAGE_RATE_WINDOW_MS
      const peerMembershipIds = await database.listPeerMembershipIds(
        conversationId,
        openid,
        orderAccess ? orderAccess.peerOpenids : null
      )
      const messageId = createMessageId(openid, normalized.value.requestId)
      if (
        normalized.value.kind === 'voice' &&
        !cloudFileMatchesVoicePath(
          normalized.value.fileID,
          voicePathForMessage(messageId)
        )
      ) {
        return { code: -3, error: '语音文件与消息任务不匹配' }
      }
      const result = await database.commitMessage({
        messageId: messageId,
        rateLimitId: createMessageRateLimitId(openid, windowStartMs),
        openid: openid,
        conversationId: conversationId,
        requestId: normalized.value.requestId,
        kind: normalized.value.kind,
        content: normalized.value.content,
        fileID: normalized.value.fileID,
        dur: normalized.value.dur,
        preview: normalized.value.preview,
        membershipId: membership._id,
        peerMembershipIds: peerMembershipIds,
        createdAtMs: timestamp,
        windowStartMs: windowStartMs,
        maximumMessages: MESSAGE_RATE_LIMIT,
        rateLimitExpiresAtMs: windowStartMs + (2 * MESSAGE_RATE_WINDOW_MS)
      })
      if (result.status === 'rate-limited') {
        return { code: -4, error: '消息发送过于频繁，请稍后再试' }
      }
      if (result.status !== 'created' && result.status !== 'duplicate') {
        const unexpected = new Error('Unexpected message transaction result')
        unexpected.code = 'UNEXPECTED_MESSAGE_RESULT'
        throw unexpected
      }
      return {
        code: 0,
        data: { messageId: messageId, duplicate: result.status === 'duplicate' }
      }
    } catch (error) {
      logger.error('sendMessage failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '发送失败' }
    }
  }
}

module.exports = { createSendMessageHandler }
