const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ALLOWED_ROLES = new Set(['student', 'mentor'])

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  const role = ALLOWED_ROLES.has(event.role) ? event.role : 'student'

  try {
    const result = await db.collection('users')
      .where({ _openid: openid, role: role })
      .limit(1)
      .get()

    if (result.data.length === 0) {
      return { code: -3, error: '用户不存在或角色不匹配' }
    }

    const name = cleanText(event.name, 30)
    if (!name) return { code: -1, error: '姓名不能为空' }

    const profile = {
      name: name,
      tag: cleanText(event.tag, 40),
      avatar: name.slice(0, 1),
      updateTime: db.serverDate()
    }

    if (role === 'mentor') {
      profile.title = cleanText(event.title, 30)
      profile.subject = cleanText(event.subject, 30)
      profile.years = cleanText(event.years, 3)
    }

    await db.collection('users').doc(result.data[0]._id).update({ data: profile })
    return { code: 0, data: Object.assign({}, result.data[0], profile) }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '档案更新失败' }
  }
}
