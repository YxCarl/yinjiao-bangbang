const cloud = require('wx-server-sdk')
const { validateApplication } = require('./application-policy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!openid) return { code: -2, error: '请先登录' }

  const validation = validateApplication(event)
  if (!validation.ok) return { code: -1, error: validation.error }

  try {
    const result = await db.collection('users')
      .where({ _openid: openid })
      .limit(20)
      .get()

    const approved = result.data.find(profile => (
      profile.role === 'mentor' && profile.mentorStatus === 'approved'
    ))
    if (approved) return { code: 0, data: approved, alreadyApproved: true }

    const profile = result.data.find(item => item.role === 'student') || result.data[0]
    if (!profile) return { code: -2, error: '请先完成登录' }
    if (profile.mentorStatus === 'pending') {
      return {
        code: 0,
        data: Object.assign({}, profile, { role: 'student', mentorStatus: 'pending' }),
        alreadyPending: true
      }
    }

    const application = {
      name: validation.data.name,
      subject: validation.data.subject,
      years: validation.data.years,
      summary: validation.data.summary,
      submittedAt: db.serverDate()
    }
    const update = {
      role: 'student',
      mentorStatus: 'pending',
      mentorApplication: application,
      name: validation.data.name,
      subject: validation.data.subject,
      years: validation.data.years,
      updateTime: db.serverDate()
    }

    await db.collection('users').doc(profile._id).update({ data: update })
    return { code: 0, data: Object.assign({}, profile, update) }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '申请提交失败' }
  }
}
