const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { typeText, title, price, detail } = event

  try {
    // 1. 查学生用户余额
    const userResult = await db.collection('users').where({ _openid: openid, role: 'student' }).get()
    if (userResult.data.length === 0) {
      return { code: -1, msg: '用户不存在' }
    }
    const user = userResult.data[0]
    const balance = parseFloat(user.balance || 0)

    // 2. 扣费校验
    if (balance < price) {
      return { code: -2, msg: '余额不足，当前余额 ¥' + balance.toFixed(2) }
    }

    // 3. 扣费
    const newBalance = balance - price
    await db.collection('users').doc(user._id).update({
      data: { balance: newBalance }
    })

    // 4. 拼描述
    let desc = ''
    if (detail) {
      if (detail.content) desc = detail.content
      else if (detail.subject) desc = detail.subject + ' · ' + (detail.level || '')
      else if (detail.videoName) desc = '视频诊断 · ' + detail.videoName
    }

    // 5. 创建订单（status: 0 = 待接单, 1 = 进行中, 2 = 已完成）
    const orderResult = await db.collection('orders').add({
      data: {
        _openid: openid,
        typeText: typeText,
        title: title,
        price: price,
        status: 0,
        student: user.name || '学员',
        desc: desc,
        createTime: db.serverDate(),
        detail: detail || {}
      }
    })

    return { code: 0, data: { _id: orderResult._id, balance: newBalance } }
  } catch (e) {
    console.error(e)
    return { code: -1, msg: '服务器错误' }
  }
}
