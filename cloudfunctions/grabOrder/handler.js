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

      const result = await database.claimOrderAtomically({ orderId, mentorId: mentor._id, openid })
      if (result.status === 'not-approved') return { code: -3, error: '导师认证状态已变更' }
      if (result.status === 'self-claim') return { code: -3, error: '不能接取自己的订单' }
      if (result.status === 'not-found') return { code: -1, error: '订单不存在' }
      if (['conflict', 'order-changed'].includes(result.status)) {
        return { code: -2, error: '订单状态已变更，请刷新后重试' }
      }
      if (!['claimed', 'already-claimed'].includes(result.status)) {
        return { code: -1, error: '订单状态异常，无法接单' }
      }
      return { code: 0, data: { teacher: result.teacher } }
    } catch (error) {
      logger.error('grabOrder failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '接单失败' }
    }
  }
}

module.exports = { createGrabOrderHandler }
