const cloud = require('wx-server-sdk')
const {
  buildStudentProfile,
  normalizeRequestedRole,
  secureClientProfile,
  selectProfile
} = require('./profile-policy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  const requestedRole = normalizeRequestedRole(event && event.role)

  if (!openid) return { code: -2, error: '请先登录' }

  try {
    const result = await db.collection('users')
      .where({ _openid: openid })
      .limit(20)
      .get()

    const existing = selectProfile(result.data, requestedRole)
    if (existing) {
      return {
        code: 0,
        data: secureClientProfile(existing),
        requestedRole: requestedRole
      }
    }

    const newProfile = buildStudentProfile(openid, db.serverDate())
    const addResult = await db.collection('users').add({ data: newProfile })
    return {
      code: 0,
      data: Object.assign({}, newProfile, { _id: addResult._id }),
      requestedRole: requestedRole
    }
  } catch (error) {
    console.error(error)
    return { code: -1, error: '登录失败' }
  }
}
