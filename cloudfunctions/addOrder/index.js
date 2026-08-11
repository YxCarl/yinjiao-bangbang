const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { typeText, title, price, detail } = event

  const numPrice = parseFloat(price)
  if (!numPrice || numPrice <= 0 || numPrice > 10000) return { code: -1, error: '金额无效' }

  const safeType = typeof typeText === 'string' ? typeText.trim().slice(0, 20) : ''
  const safeTitle = typeof title === 'string' ? title.trim().slice(0, 100) : ''
  if (!safeType || !safeTitle) return { code: -1, error: '订单类型和标题不能为空' }

  try {
    const userResult = await db.collection('users').where({ _openid: openid, role: 'student' }).get()
    if (userResult.data.length === 0) {
      return { code: -1, error: '用户不存在' }
    }
    const user = userResult.data[0]
    const balance = parseFloat(user.balance || 0)

    if (balance < numPrice) {
      return { code: -2, error: '余额不足，当前余额 ¥' + balance.toFixed(2) }
    }

    const newBalance = Math.round((balance - numPrice) * 100) / 100
    await db.collection('users').doc(user._id).update({
      data: { balance: newBalance }
    })

    let desc = ''
    if (detail) {
      if (detail.content) desc = detail.content
      else if (detail.subject) desc = (detail.grade || '') + detail.subject + ' · ' + (detail.level || '')
      else if (detail.videoName) desc = '视频诊断 · ' + detail.videoName
    }

    const orderResult = await db.collection('orders').add({
      data: {
        _openid: openid,
        typeText: safeType,
        title: safeTitle,
        price: numPrice,
        status: 0,
        studentId: user._id,
        student: user.name || '学员',
        studentAvatar: user.avatar || (user.name ? user.name[0] : '学'),
        desc: desc,
        createTime: db.serverDate(),
        detail: detail || {}
      }
    })

    return { code: 0, data: { _id: orderResult._id, balance: newBalance } }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '创建订单失败' }
  }
}
