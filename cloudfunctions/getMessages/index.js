const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { conversationId } = event

  try {
    const result = await db.collection('messages')
      .where({ conversationId: conversationId })
      .orderBy('createTime', 'asc')
      .get()

    const data = result.data.map(m => ({
      _id: m._id,
      side: m._openid === openid ? 'out' : 'in',
      kind: m.kind || 'text',
      content: m.content || '',
      createTime: m.createTime
    }))

    return { code: 0, data: data }
  } catch (e) {
    console.error(e)
    return { code: -1, error: e }
  }
}
