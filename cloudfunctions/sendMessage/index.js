const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { conversationId, kind, content, role } = event

  if (!conversationId) return { code: -1, error: '参数错误' }

  try {
    await db.collection('messages').add({
      data: {
        _openid: openid,
        conversationId: conversationId,
        kind: kind || 'text',
        content: content || '',
        senderRole: role || '',
        isRead: false,
        createTime: db.serverDate()
      }
    })

    const preview = (kind === 'text' ? content : (kind === '_read' ? '' : '[语音]'))
    if (!preview) return { code: 0 }

    const myConv = await db.collection('conversations')
      .where({ _openid: openid, conversationId: conversationId })
      .get()

    if (myConv.data.length > 0) {
      await db.collection('conversations').doc(myConv.data[0]._id).update({
        data: { lastMsg: preview, lastTime: db.serverDate() }
      })
    }

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
