const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function ensureConversation(openid, conversationId, details) {
  const existing = await db.collection('conversations')
    .where({ _openid: openid, conversationId: conversationId })
    .limit(1)
    .get()

  if (existing.data.length > 0) return

  await db.collection('conversations').add({
    data: Object.assign({
      _openid: openid,
      conversationId: conversationId,
      lastMsg: '订单已进入指导阶段',
      lastTime: db.serverDate(),
      unread: 0
    }, details)
  })
}

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  const orderId = typeof event.orderId === 'string' ? event.orderId : ''
  if (!orderId) return { code: -1, error: '参数错误' }

  try {
    const mentorResult = await db.collection('users')
      .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
      .limit(1)
      .get()

    if (mentorResult.data.length === 0) {
      return { code: -3, error: '仅导师可以接单' }
    }

    const mentor = mentorResult.data[0]
    const orderResult = await db.collection('orders').doc(orderId).get()
    const order = orderResult.data
    if (!order) return { code: -1, error: '订单不存在' }

    if (order.status === 0) {
      const claimResult = await db.collection('orders')
        .where({ _id: orderId, status: 0 })
        .update({
          data: {
            status: 1,
            teacher: mentor.name || '导师',
            teacherId: mentor._id,
            teacherAvatar: mentor.avatar || '师',
            claimTime: db.serverDate()
          }
        })

      if (!claimResult.stats || claimResult.stats.updated !== 1) {
        return { code: -2, error: '订单已被其他导师接取' }
      }
    } else if (order.status !== 1 || order.teacherId !== mentor._id) {
      return { code: -2, error: '订单不存在或已被接取' }
    }

    const conversationId = 'order_' + orderId
    await Promise.all([
      ensureConversation(order._openid, conversationId, {
        participantRole: 'student',
        peerName: mentor.name || '导师',
        peerTheme: 'badge-primary',
        orderTitle: order.title || ''
      }),
      ensureConversation(openid, conversationId, {
        participantRole: 'mentor',
        peerName: order.student || '学员',
        peerTheme: 'badge-accent',
        orderTitle: order.title || ''
      })
    ])

    return { code: 0, data: { teacher: mentor.name || '导师' } }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '接单失败' }
  }
}
