const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { conversationId } = event

  try {
    const result = await db.collection('messages')
      .where({ conversationId: conversationId })
      .orderBy('createTime', 'asc')
      .get()

    return { code: 0, data: result.data }
  } catch (e) {
    console.error(e)
    return { code: -1, error: e }
  }
}
