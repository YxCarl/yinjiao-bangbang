const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function getLegacyOrderAccess(openid, conversationId) {
  if (!conversationId.startsWith('order_')) return null
  const orderId = conversationId.slice('order_'.length)
  if (!orderId) return null

  try {
    const orderResult = await db.collection('orders').doc(orderId).get()
    const order = orderResult.data
    if (!order) return null
    if (order._openid === openid) {
      return {
        participantRole: 'student',
        peerName: order.teacher || '导师',
        orderTitle: order.title || ''
      }
    }

    const mentors = await db.collection('users')
      .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
      .get()
    if (mentors.data.some(mentor => mentor._id === order.teacherId)) {
      return {
        participantRole: 'mentor',
        peerName: order.student || '学员',
        orderTitle: order.title || ''
      }
    }
    return null
  } catch (_) {
    return null
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { conversationId, kind, content, fileID, dur } = event

  if (!conversationId) return { code: -1, error: '参数错误' }

  try {
    let myConv = await db.collection('conversations')
      .where({ _openid: openid, conversationId: conversationId })
      .limit(1)
      .get()

    const orderAccess = conversationId.startsWith('order_')
      ? await getLegacyOrderAccess(openid, conversationId)
      : null

    if (conversationId.startsWith('order_') && !orderAccess) {
      return { code: -3, error: '无权访问此会话' }
    }
    if (!conversationId.startsWith('order_') && myConv.data.length === 0) {
      return { code: -3, error: '无权访问此会话' }
    }

    if (myConv.data.length === 0 && orderAccess) {

      const created = await db.collection('conversations').add({
        data: {
          _openid: openid,
          conversationId: conversationId,
          participantRole: orderAccess.participantRole,
          peerName: orderAccess.peerName,
          orderTitle: orderAccess.orderTitle,
          lastMsg: '',
          lastTime: db.serverDate(),
          unread: 0
        }
      })
      myConv = { data: [{ _id: created._id }] }
    }

    if (kind === '_read') {
      await db.collection('conversations').doc(myConv.data[0]._id).update({
        data: { unread: 0 }
      })
      return { code: 0 }
    }

    const normalizedKind = kind === 'voice' ? 'voice' : 'text'
    const normalizedContent = typeof content === 'string' ? content.trim().slice(0, 2000) : ''
    if (!normalizedContent) return { code: -1, error: '消息内容不能为空' }

    await db.collection('messages').add({
      data: {
        _openid: openid,
        conversationId: conversationId,
        kind: normalizedKind,
        content: normalizedContent,
        fileID: normalizedKind === 'voice' && typeof fileID === 'string' ? fileID : '',
        dur: normalizedKind === 'voice' ? Math.max(0, Math.min(Number(dur) || 0, 60)) : 0,
        isRead: false,
        createTime: db.serverDate()
      }
    })

    const preview = normalizedKind === 'text' ? normalizedContent : '[语音]'

    await db.collection('conversations').doc(myConv.data[0]._id).update({
      data: { lastMsg: preview, lastTime: db.serverDate() }
    })

    const allConvs = await db.collection('conversations')
      .where({ conversationId: conversationId })
      .get()

    const updates = allConvs.data
      .filter(doc => doc._openid !== openid)
      .map(doc => db.collection('conversations').doc(doc._id).update({
        data: { lastMsg: preview, lastTime: db.serverDate(), unread: _.inc(1) }
      }))

    if (updates.length > 0) await Promise.all(updates)

    return { code: 0 }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '发送失败' }
  }
}
