const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!openid) return { code: -2, error: '请先登录' }

  try {
    const result = await db.collection('users')
      .where({ _openid: openid })
      .limit(20)
      .get()

    if (result.data.length === 0) {
      return { code: -3, error: '用户不存在' }
    }

    const approvedMentor = result.data.find(profile => (
      profile.role === 'mentor' && profile.mentorStatus === 'approved'
    ))
    const currentProfile = approvedMentor ||
      result.data.find(profile => profile.role === 'student') ||
      result.data[0]
    const isMentor = Boolean(approvedMentor && currentProfile._id === approvedMentor._id)

    if (event.role === 'mentor' && !isMentor) {
      return { code: -3, error: '导师身份尚未通过审核' }
    }

    const name = cleanText(event.name, 30)
    if (!name) return { code: -1, error: '姓名不能为空' }

    const profile = {
      name: name,
      tag: cleanText(event.tag, 40),
      avatar: name.slice(0, 1),
      updateTime: db.serverDate()
    }

    if (isMentor) {
      profile.title = cleanText(event.title, 30)
      profile.subject = cleanText(event.subject, 30)
      profile.years = cleanText(event.years, 3)
    }

    await db.collection('users').doc(currentProfile._id).update({ data: profile })
    return { code: 0, data: Object.assign({}, currentProfile, profile) }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '档案更新失败' }
  }
}
