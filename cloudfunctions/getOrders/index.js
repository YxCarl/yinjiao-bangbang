const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { scope } = event

  try {
    let query = db.collection('orders').orderBy('createTime', 'desc').limit(50)

    if (scope === 'all') {
      const userRes = await db.collection('users')
        .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
        .limit(1)
        .get()

      if (userRes.data.length === 0) {
        return { code: -3, error: '仅导师可以查看需求大厅' }
      }
    } else {
      query = query.where({ _openid: openid })
    }

    const result = await query.get()
    return { code: 0, data: result.data }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '加载订单失败' }
  }
}
