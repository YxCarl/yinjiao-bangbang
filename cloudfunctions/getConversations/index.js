const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getApprovedMentors(openid) {
  const result = await db.collection('users')
    .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
    .limit(5)
    .get()
  return result.data
}

async function canReadConversation(openid, conversation, approvedMentors) {
  if (conversation.participantRole === 'student') return true
  if (conversation.participantRole === 'mentor') return approvedMentors.length > 0

  const conversationId = conversation.conversationId || ''
  if (!conversationId.startsWith('order_')) return true

  const orderId = conversationId.slice('order_'.length)
  if (!orderId) return false

  try {
    const result = await db.collection('orders').doc(orderId).get()
    const order = result.data
    if (!order) return false
    if (order._openid === openid) return true
    return approvedMentors.some(mentor => mentor._id === order.teacherId)
  } catch (_) {
    return false
  }
}

exports.main = async () => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!openid) return { code: -2, error: '请先登录' }

  try {
    const [result, approvedMentors] = await Promise.all([
      db.collection('conversations')
        .where({ _openid: openid })
        .orderBy('lastTime', 'desc')
        .get(),
      getApprovedMentors(openid)
    ])

    const checks = await Promise.all(result.data.map(conversation => (
      canReadConversation(openid, conversation, approvedMentors)
    )))
    const conversations = result.data.filter((_, index) => checks[index])

    return { code: 0, data: conversations }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '加载会话失败' }
  }
}
