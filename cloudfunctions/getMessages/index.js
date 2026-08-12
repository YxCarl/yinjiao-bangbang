const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function canAccessLegacyOrder(openid, conversationId) {
  if (!conversationId.startsWith('order_')) return false
  const orderId = conversationId.slice('order_'.length)
  if (!orderId) return false

  try {
    const orderResult = await db.collection('orders').doc(orderId).get()
    const order = orderResult.data
    if (!order) return false
    if (order._openid === openid) return true

    const mentors = await db.collection('users')
      .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
      .get()
    return mentors.data.some(mentor => mentor._id === order.teacherId)
  } catch (_) {
    return false
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { conversationId } = event

  if (!conversationId) return { code: -1, error: '参数错误' }

  try {
    const membership = await db.collection('conversations')
      .where({ _openid: openid, conversationId: conversationId })
      .limit(1)
      .get()

    const hasAccess = conversationId.startsWith('order_')
      ? await canAccessLegacyOrder(openid, conversationId)
      : membership.data.length > 0

    if (!hasAccess) {
      return { code: -3, error: '无权访问此会话' }
    }

    const result = await db.collection('messages')
      .where({ conversationId: conversationId })
      .orderBy('createTime', 'asc')
      .get()

    const data = result.data.map(m => ({
      _id: m._id,
      side: m._openid === openid ? 'out' : 'in',
      kind: m.kind || 'text',
      content: m.content || '',
      fileID: m.fileID || '',
      dur: m.dur || 0,
      createTime: m.createTime
    }))

    return { code: 0, data: data }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '加载消息失败' }
  }
}
