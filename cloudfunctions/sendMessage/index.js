const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { conversationId, kind, content } = event

  try {
    // 1. 写入消息
    await db.collection('messages').add({
      data: {
        _openid: openid,
        conversationId: conversationId,
        kind: kind || 'text',
        content: content || '',
        isRead: false,
        createTime: db.serverDate()
      }
    })

    // 2. 查找该会话的所有 conversation 文档
    const convResult = await db.collection('conversations')
      .where({ conversationId: conversationId })
      .get()

    const preview = (kind === 'text' ? content : '[语音]')

    // 3. 更新每个 conversation 文档
    for (const doc of convResult.data) {
      if (doc._openid === openid) {
        // 发送方：更新 lastMsg 和 lastTime，不增加未读
        await db.collection('conversations').doc(doc._id).update({
          data: { lastMsg: preview, lastTime: db.serverDate() }
        })
      } else {
        // 接收方：更新 lastMsg、lastTime，未读 +1
        await db.collection('conversations').doc(doc._id).update({
          data: {
            lastMsg: preview,
            lastTime: db.serverDate(),
            unread: _.inc(1)
          }
        })
      }
    }

    return { code: 0 }
  } catch (e) {
    console.error(e)
    return { code: -1, error: e }
  }
}
