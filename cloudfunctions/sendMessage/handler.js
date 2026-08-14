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
  return {
    participantRole: 'mentor',
    peerName: order.student || '学员',
    orderTitle: order.title || '',
    peerOpenids: order._openid ? [order._openid] : []
  }
}

function createSendMessageHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function sendMessage(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const conversationId = typeof event.conversationId === 'string'
      ? event.conversationId.trim()
      : ''
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

      const normalizedKind = event.kind === 'voice' ? 'voice' : 'text'
      const normalizedContent = typeof event.content === 'string'
        ? event.content.trim().slice(0, 2000)
        : ''
      if (!normalizedContent) return { code: -1, error: '消息内容不能为空' }

      await database.addMessage({
        openid: openid,
        conversationId: conversationId,
        kind: normalizedKind,
        content: normalizedContent,
        fileID: normalizedKind === 'voice' && typeof event.fileID === 'string'
          ? event.fileID
          : '',
        dur: normalizedKind === 'voice'
          ? Math.max(0, Math.min(Number(event.dur) || 0, 60))
          : 0
      })

      const preview = normalizedKind === 'text' ? normalizedContent : '[语音]'
      await database.updateMembershipPreview(membership._id, preview)
      await database.incrementPeerUnread(
        conversationId,
        openid,
        preview,
        orderAccess ? orderAccess.peerOpenids : null
      )

      return { code: 0 }
    } catch (error) {
      logger.error('sendMessage failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '发送失败' }
    }
  }
}

module.exports = { createSendMessageHandler }
