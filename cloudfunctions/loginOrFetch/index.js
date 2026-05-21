const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { role } = event

  try {
    const existResult = await db.collection('users')
      .where({ _openid: openid, role: role || 'student' })
      .get()

    if (existResult.data.length > 0) {
      return { code: 0, data: existResult.data[0] }
    }

    const baseProfile = {
      _openid: openid,
      role: role || 'student',
      createTime: db.serverDate()
    }

    let newProfile
    if (role === 'mentor') {
      newProfile = Object.assign({}, baseProfile, {
        name: '银龄教师',
        tag: '退休/在岗资深教师',
        avatar: '师',
        title: '资深教师',
        subject: '待完善',
        years: '0',
        rating: '5.0',
        balance: '0.00',
        orderCount: 0
      })
    } else {
      newProfile = Object.assign({}, baseProfile, {
        name: '微信用户',
        tag: '教育行业新人',
        avatar: '新',
        balance: '50.00'
      })
    }

    const addResult = await db.collection('users').add({ data: newProfile })
    return { code: 0, data: Object.assign({}, newProfile, { _id: addResult._id }) }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '登录失败' }
  }
}
