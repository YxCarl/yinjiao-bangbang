function orderIdFromConversation(conversationId) {
  if (!conversationId.startsWith('order_')) return ''
  return conversationId.slice('order_'.length)
}

const PAGE_SIZE = 50
const MAX_SCAN = 200

async function canReadConversation(database, openid, conversation, approvedMentorIds) {
  const conversationId = typeof conversation.conversationId === 'string'
    ? conversation.conversationId
    : ''
  const orderId = orderIdFromConversation(conversationId)
  if (!orderId) return conversationId && !conversationId.startsWith('order_')

  const order = await database.getOrder(orderId)
  if (!order) return false
  if (order._openid === openid) return true
  return approvedMentorIds.has(order.teacherId) ? order : false
}

function createGetConversationsHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function getConversations() {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    try {
      const approvedMentors = await database.findApprovedMentors(openid)
      const approvedMentorIds = new Set(approvedMentors.map(mentor => mentor._id))
      const visible = []
      let scanned = 0
      let exhausted = false

      while (visible.length < PAGE_SIZE && scanned < MAX_SCAN) {
        const batch = await database.listConversations(openid, scanned, PAGE_SIZE)
        scanned += batch.length
        if (batch.length < PAGE_SIZE) exhausted = true
        const access = await Promise.all(batch.map(conversation => (
          canReadConversation(database, openid, conversation, approvedMentorIds)
        )))
        batch.forEach((conversation, index) => {
          if (!access[index] || visible.length >= PAGE_SIZE) return
          const order = access[index] === true ? null : access[index]
          const anonymous = order && (order.anonymous === true ||
            (order.typeText === '问诊室' && typeof order.title === 'string' && order.title.startsWith('【匿名】')))
          visible.push(anonymous
            ? { ...conversation, peerName: '匿名学员', orderTitle: '教育职场咨询' }
            : conversation)
        })
        if (exhausted) break
      }

      return {
        code: 0,
        data: visible,
        scanLimitReached: scanned >= MAX_SCAN && !exhausted && visible.length < PAGE_SIZE
      }
    } catch (error) {
      logger.error('getConversations failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '加载会话失败' }
    }
  }
}

module.exports = { createGetConversationsHandler }
