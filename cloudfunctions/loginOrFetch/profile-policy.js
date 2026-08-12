const MENTOR_STATUSES = new Set([
  'not_requested',
  'pending',
  'approved',
  'rejected'
])

function normalizeRequestedRole(role) {
  return role === 'mentor' ? 'mentor' : 'student'
}

function normalizeMentorStatus(profile) {
  if (profile && MENTOR_STATUSES.has(profile.mentorStatus)) {
    return profile.mentorStatus
  }
  return profile && profile.role === 'mentor' ? 'pending' : 'not_requested'
}

function isApprovedMentor(profile) {
  return Boolean(
    profile &&
    profile.role === 'mentor' &&
    profile.mentorStatus === 'approved'
  )
}

function secureClientProfile(profile) {
  const mentorStatus = normalizeMentorStatus(profile)
  return Object.assign({}, profile, {
    role: isApprovedMentor(profile) ? 'mentor' : 'student',
    mentorStatus: mentorStatus
  })
}

function selectProfile(profiles, requestedRole) {
  if (!Array.isArray(profiles) || profiles.length === 0) return null
  if (requestedRole === 'student') {
    return profiles.find(profile => profile.role === 'student') ||
      profiles.find(isApprovedMentor) ||
      profiles[0]
  }
  return profiles.find(isApprovedMentor) ||
    profiles.find(profile => profile.role === 'student') ||
    profiles[0]
}

function buildStudentProfile(openid, createTime) {
  return {
    _openid: openid,
    role: 'student',
    mentorStatus: 'not_requested',
    createTime: createTime,
    name: '微信用户',
    tag: '教育行业新人',
    avatar: '新',
    balance: '50.00'
  }
}

module.exports = {
  buildStudentProfile,
  isApprovedMentor,
  normalizeMentorStatus,
  normalizeRequestedRole,
  secureClientProfile,
  selectProfile
}
