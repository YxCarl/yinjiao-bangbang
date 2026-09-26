const PUBLIC_ORDER_TITLES = {
  '磨课坊': '教案精修需求',
  '诊课室': '试讲诊断需求',
  '问诊室': '教育问答需求'
}

function publicOrderSummary(order) {
  const typeText = Object.prototype.hasOwnProperty.call(PUBLIC_ORDER_TITLES, order.typeText)
    ? order.typeText
    : '其他'
  return {
    _id: order._id,
    status: 0,
    typeText: typeText,
    title: PUBLIC_ORDER_TITLES[typeText] || '指导需求',
    desc: '接单后可查看详细需求',
    student: '学员',
    price: Number.isFinite(order.price) ? order.price : 0,
    createTime: order.createTime
  }
}

function assignedOrderDetails(order) {
  const anonymous = order.anonymous === true ||
    (order.typeText === '问诊室' && typeof order.title === 'string' && order.title.startsWith('【匿名】'))
  return {
    _id: order._id,
    status: order.status,
    typeText: order.typeText,
    title: order.title,
    desc: order.desc,
    student: anonymous ? '匿名学员' : order.student,
    studentAvatar: anonymous ? '匿' : order.studentAvatar,
    anonymous: anonymous,
    price: order.price,
    createTime: order.createTime,
    claimTime: order.claimTime,
    completeTime: order.completeTime,
    teacher: order.teacher,
    detail: order.detail
  }
}

function createGetOrdersHandler(dependencies) {
  const { getOpenid, database, logger } = dependencies

  return async function getOrders(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    try {
      if (event && event.scope === 'all') {
        const mentor = await database.findApprovedMentor(openid)
        if (!mentor) return { code: -3, error: '仅已认证导师可以查看需求大厅' }

        const [availableOrders, assignedOrders] = await Promise.all([
          database.listOrders({ availableOnly: true, limit: 50 }),
          database.listOrders({ assignedMentorId: mentor._id, limit: 50 })
        ])
        return {
          code: 0,
          data: [
            ...availableOrders.filter(order => order.status === 0).map(publicOrderSummary),
            ...assignedOrders
              .filter(order => order.teacherId === mentor._id && [1, 2].includes(order.status))
              .map(assignedOrderDetails)
          ]
        }
      }

      const orders = await database.listOrders({
        ownerOpenid: openid,
        limit: 50
      })
      return { code: 0, data: orders }
    } catch (error) {
      logger.error('getOrders failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '加载订单失败' }
    }
  }
}

module.exports = { createGetOrdersHandler, publicOrderSummary, assignedOrderDetails }
