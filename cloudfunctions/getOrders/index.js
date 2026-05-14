const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { scope } = event

  try {
    let query = db.collection('orders').orderBy('createTime', 'desc').limit(50)
    if (scope !== 'all') {
      query = query.where({ _openid: openid })
    }
    const result = await query.get()
    return { code: 0, data: result.data }
  } catch (e) {
    console.error(e)
    return { code: -1, error: e }
  }
}
