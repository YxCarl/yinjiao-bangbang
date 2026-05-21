const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const result = await db.collection('conversations')
      .where({ _openid: openid })
      .orderBy('lastTime', 'desc')
      .get()

    return { code: 0, data: result.data }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '加载会话失败' }
  }
}
