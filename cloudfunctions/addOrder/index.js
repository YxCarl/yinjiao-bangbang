const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  try {
    return await db.collection('orders').add({
      data: {
        _openid: wxContext.OPENID,    // 自动记录发单人身份
        typeText: event.typeText,      // 业务类型 (磨课坊/诊课室/问诊室)
        title: event.title,            // 订单标题
        price: event.price,            // 订单金额
        status: 1,                     // 1: 进行中
        createTime: db.serverDate(),   // 服务器时间
        detail: event.detail || {}     // 额外详情 (如学科、导师等级)
      }
    })
  } catch (e) {
    console.error(e)
    return e
  }
}