const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

    // 2. 更新会话的 lastMsg 和 lastTime
    await db.collection('conversations').where({ conversationId: conversationId }).update({
      data: {
        lastMsg: (kind === 'text' ? content : '[语音]'),
        lastTime: db.serverDate()
      }
    })

    return { code: 0 }
  } catch (e) {
    console.error(e)
    return { code: -1, error: e }
  }
}
