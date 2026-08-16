function createGrabOrderHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function grabOrder(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const orderId = typeof event.orderId === 'string' ? event.orderId.trim() : ''
    if (!orderId) return { code: -1, error: '参数错误' }

    try {
      const mentor = await database.findApprovedMentor(openid)
      if (!mentor) return { code: -3, error: '仅已认证导师可以接单' }

      const order = await database.getOrder(orderId)
      if (!order) return { code: -1, error: '订单不存在' }

      if (order.status === 0) {
        const claimed = await database.claimOpenOrder(orderId, mentor)
        if (!claimed) return { code: -2, error: '订单已被其他导师接取' }
      } else if (order.status !== 1 || order.teacherId !== mentor._id) {
        return { code: -2, error: '订单不存在或已被接取' }
      }

      const conversationId = 'order_' + orderId
      await Promise.all([
        database.ensureConversation(order._openid, conversationId, {
          participantRole: 'student',
          peerName: mentor.name || '导师',
          peerTheme: 'badge-primary',
          orderTitle: order.title || ''
        }),
        database.ensureConversation(openid, conversationId, {
          participantRole: 'mentor',
          peerName: order.student || '学员',
          peerTheme: 'badge-accent',
          orderTitle: order.title || ''
        })
      ])

      return { code: 0, data: { teacher: mentor.name || '导师' } }
    } catch (error) {
      logger.error('grabOrder failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '接单失败' }
    }
  }
}

module.exports = { createGrabOrderHandler }
