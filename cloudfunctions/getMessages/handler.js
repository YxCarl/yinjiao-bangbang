const { encodeCursor, decodeCursor, pageSize } = require('./cursor')

function orderIdFromConversation(conversationId) {
  if (!conversationId.startsWith('order_')) return ''
  return conversationId.slice('order_'.length)
}

async function canAccessOrder(database, openid, orderId) {
  if (!orderId) return false

  const order = await database.getOrder(orderId)
  if (!order) return false
  if (order._openid === openid) return true

  const mentor = await database.findApprovedMentor(openid)
  return Boolean(mentor && mentor._id === order.teacherId)
}

function createGetMessagesHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function getMessages(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const conversationId = typeof event.conversationId === 'string'
      ? event.conversationId.trim()
      : ''
    if (!conversationId || conversationId.length > 256) return { code: -1, error: '参数错误' }

    let cursor, limit, direction
    try {
      cursor = decodeCursor(event.cursor, conversationId)
      limit = pageSize(event.limit)
      direction = event.direction === undefined ? 'before' : event.direction
      if (!['before', 'after'].includes(direction) || (direction === 'after' && !cursor)) throw new Error('Invalid direction')
    } catch (_) {
      return { code: -1, error: '分页参数错误，请重新加载会话' }
    }

    try {
      const isOrderConversation = conversationId.startsWith('order_')
      const orderId = orderIdFromConversation(conversationId)
      const hasAccess = isOrderConversation
        ? await canAccessOrder(database, openid, orderId)
        : Boolean(await database.getMembership(openid, conversationId))

      if (!hasAccess) return { code: -3, error: '无权访问此会话' }

      const rows = await database.listMessages(conversationId, { cursor, direction, limit: limit + 1 })
      const hasMore = rows.length > limit
      const selected = rows.slice(0, limit)
      const nextCursor = hasMore ? encodeCursor(selected[selected.length - 1], 'createTime', conversationId) : ''
      const messages = direction === 'before' ? selected.reverse() : selected
      const data = messages.map(message => ({
        _id: message._id,
        side: message._openid === openid ? 'out' : 'in',
        kind: message.kind || 'text',
        content: message.content || '',
        fileID: message.fileID || '',
        dur: message.dur || 0,
        createTime: message.createTime
      }))

      return {
        code: 0, data, hasMore, nextCursor,
        latestCursor: messages.length ? encodeCursor(messages[messages.length - 1], 'createTime', conversationId) : '',
        oldestCursor: messages.length ? encodeCursor(messages[0], 'createTime', conversationId) : ''
      }
    } catch (error) {
      logger.error('getMessages failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '加载消息失败' }
    }
  }
}

module.exports = { createGetMessagesHandler }
