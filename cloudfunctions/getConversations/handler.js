const { encodeCursor, decodeCursor, pageSize } = require('./cursor')

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

  return async function getConversations(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    let cursor, limit
    try {
      cursor = decodeCursor(event.cursor, openid)
      limit = pageSize(event.limit)
    } catch (_) {
      return { code: -1, error: '分页参数错误，请刷新会话列表' }
    }

    try {
      const approvedMentors = await database.findApprovedMentors(openid)
      const approvedMentorIds = new Set(approvedMentors.map(mentor => mentor._id))
      const visible = []
      let scanned = 0
      let exhausted = false

      let nextCursor = ''
      while (visible.length < limit && scanned < MAX_SCAN) {
        const batchSize = Math.min(PAGE_SIZE, MAX_SCAN - scanned)
        const batch = await database.listConversations(openid, { cursor, limit: batchSize })
        if (batch.length === 0) { exhausted = true; break }
        const access = await Promise.all(batch.map(conversation => (
          canReadConversation(database, openid, conversation, approvedMentorIds)
        )))
        let consumed = 0
        for (let index = 0; index < batch.length; index += 1) {
          const conversation = batch[index]
          consumed += 1
          scanned += 1
          nextCursor = encodeCursor(conversation, openid)
          cursor = decodeCursor(nextCursor, openid)
          if (!access[index]) continue
          const order = access[index] === true ? null : access[index]
          const anonymous = order && (order.anonymous === true ||
            (order.typeText === '问诊室' && typeof order.title === 'string' && order.title.startsWith('【匿名】')))
          visible.push(anonymous
            ? { ...conversation, peerName: '匿名学员', orderTitle: '教育职场咨询' }
            : conversation)
          if (visible.length >= limit) break
        }
        exhausted = consumed === batch.length && batch.length < batchSize
        if (exhausted) break
      }

      return {
        code: 0,
        data: visible,
        hasMore: !exhausted,
        nextCursor: exhausted ? '' : nextCursor,
        scanLimitReached: scanned >= MAX_SCAN && !exhausted && visible.length < limit
      }
    } catch (error) {
      logger.error('getConversations failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '加载会话失败' }
    }
  }
}

module.exports = { createGetConversationsHandler }
