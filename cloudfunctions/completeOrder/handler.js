function createCompleteOrderHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function completeOrder(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const orderId = typeof event.orderId === 'string' ? event.orderId.trim() : ''
    if (!orderId) return { code: -1, error: '参数错误' }

    try {
      const mentor = await database.findApprovedMentor(openid)
      if (!mentor) return { code: -3, error: '仅已认证导师可以完成订单' }

      const order = await database.getOrder(orderId)
      if (!order) return { code: -1, error: '订单不存在' }
      if (order.teacherId !== mentor._id) {
        return { code: -3, error: '只能完成由自己接取的订单' }
      }
      if (order.status !== 1) return { code: -2, error: '订单状态不允许完成' }

      const completed = await database.completeAssignedOrder(orderId, mentor._id)
      if (!completed) return { code: -2, error: '订单状态已发生变化' }

      return { code: 0, data: { status: 2 } }
    } catch (error) {
      logger.error('completeOrder failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '订单更新失败' }
    }
  }
}

module.exports = { createCompleteOrderHandler }
