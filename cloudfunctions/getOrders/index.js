const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  try {
    // 只查询当前用户自己的订单，并按时间倒序排列
    return await db.collection('orders')
      .where({
        _openid: wxContext.OPENID
      })
      .orderBy('createTime', 'desc')
      .get()
  } catch (e) {
    console.error(e)
    return e
  }
}