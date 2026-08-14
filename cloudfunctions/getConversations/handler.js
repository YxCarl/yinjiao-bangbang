function orderIdFromConversation(conversationId) {
  if (!conversationId.startsWith('order_')) return ''
  return conversationId.slice('order_'.length)
}

async function canReadConversation(database, openid, conversation, approvedMentorIds) {
  const conversationId = typeof conversation.conversationId === 'string'
    ? conversation.conversationId
    : ''
  const orderId = orderIdFromConversation(conversationId)
  if (!orderId) return !conversationId.startsWith('order_')

  const order = await database.getOrder(orderId)
  if (!order) return false
  if (order._openid === openid) return true
  return approvedMentorIds.has(order.teacherId)
}

function createGetConversationsHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function getConversations() {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    try {
      const [conversations, approvedMentors] = await Promise.all([
        database.listConversations(openid),
        database.findApprovedMentors(openid)
      ])
      const approvedMentorIds = new Set(approvedMentors.map(mentor => mentor._id))
      const checks = await Promise.all(conversations.map(conversation => (
        canReadConversation(database, openid, conversation, approvedMentorIds)
      )))

      return {
        code: 0,
        data: conversations.filter((_, index) => checks[index])
      }
    } catch (error) {
      logger.error('getConversations failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '加载会话失败' }
    }
  }
}

module.exports = { createGetConversationsHandler }
