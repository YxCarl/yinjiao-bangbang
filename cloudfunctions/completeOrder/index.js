const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  const orderId = typeof event.orderId === 'string' ? event.orderId : ''
  if (!orderId) return { code: -1, error: '参数错误' }

  try {
    const mentorResult = await db.collection('users')
      .where({ _openid: openid, role: 'mentor' })
      .limit(1)
      .get()

    if (mentorResult.data.length === 0) {
      return { code: -3, error: '仅导师可以完成订单' }
    }

    const mentor = mentorResult.data[0]
    const orderResult = await db.collection('orders').doc(orderId).get()
    const order = orderResult.data
    if (!order) return { code: -1, error: '订单不存在' }
    if (order.teacherId !== mentor._id) return { code: -3, error: '只能完成由自己接取的订单' }
    if (order.status !== 1) return { code: -2, error: '订单状态不允许完成' }

    await db.collection('orders').doc(orderId).update({
      data: { status: 2, completeTime: db.serverDate() }
    })
    return { code: 0, data: { status: 2 } }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '订单更新失败' }
  }
}
