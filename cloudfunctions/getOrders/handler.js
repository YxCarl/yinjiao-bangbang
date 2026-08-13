function createGetOrdersHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function getOrders(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    try {
      if (event.scope === 'all') {
        const mentor = await database.findApprovedMentor(openid)
        if (!mentor) return { code: -3, error: '仅已认证导师可以查看需求大厅' }
      }

      const orders = await database.listOrders({
        ownerOpenid: event.scope === 'all' ? '' : openid,
        limit: 50
      })
      return { code: 0, data: orders }
    } catch (error) {
      logger.error('getOrders failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '加载订单失败' }
    }
  }
}

module.exports = { createGetOrdersHandler }
