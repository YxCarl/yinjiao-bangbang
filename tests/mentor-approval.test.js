const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const profilePolicy = require('../cloudfunctions/loginOrFetch/profile-policy')
const applicationPolicy = require('../cloudfunctions/submitMentorApplication/application-policy')

function sourceOf(functionName) {
  return fs.readFileSync(path.join(root, 'cloudfunctions', functionName, 'index.js'), 'utf8')
}

function allRuntimeSourcesOf(functionName) {
  const functionRoot = path.join(root, 'cloudfunctions', functionName)
  return fs.readdirSync(functionRoot)
    .filter(file => file.endsWith('.js'))
    .map(file => fs.readFileSync(path.join(functionRoot, file), 'utf8'))
    .join('\n')
}

test('a client-selected mentor role never creates mentor privileges', () => {
  assert.equal(profilePolicy.normalizeRequestedRole('mentor'), 'mentor')

  const profile = profilePolicy.buildStudentProfile('openid-1', 'now')
  assert.equal(profile.role, 'student')
  assert.equal(profile.mentorStatus, 'not_requested')
})

test('legacy mentors fail closed until an explicit approval is recorded', () => {
  const legacy = profilePolicy.secureClientProfile({
    _id: 'legacy-mentor',
    role: 'mentor'
  })
  assert.equal(legacy.role, 'student')
  assert.equal(legacy.mentorStatus, 'pending')

  const approved = profilePolicy.secureClientProfile({
    _id: 'approved-mentor',
    role: 'mentor',
    mentorStatus: 'approved'
  })
  assert.equal(approved.role, 'mentor')
})

test('an explicitly approved mentor profile wins over duplicate legacy profiles', () => {
  const profiles = [
    { _id: 'student', role: 'student', mentorStatus: 'pending' },
    { _id: 'mentor', role: 'mentor', mentorStatus: 'approved' }
  ]
  assert.equal(profilePolicy.selectProfile(profiles, 'mentor')._id, 'mentor')
  assert.equal(profilePolicy.selectProfile(profiles, 'student')._id, 'student')
})

test('mentor applications are bounded and remain reviewable', () => {
  const valid = applicationPolicy.validateApplication({
    name: '李老师',
    subject: '初中语文',
    years: '20',
    summary: '具有二十年一线教学与教研工作经历。'
  })
  assert.equal(valid.ok, true)

  assert.equal(applicationPolicy.validateApplication({
    name: '李老师', subject: '初中语文', years: '61', summary: '具有长期教学工作经历。'
  }).ok, false)
  assert.equal(applicationPolicy.validateApplication({
    name: '李老师', subject: '初中语文', years: '20', summary: '过短'
  }).ok, false)
})

test('every mentor-sensitive Cloud Function requires explicit approval', () => {
  const guardedFunctions = [
    'completeOrder',
    'getConversations',
    'getMessages',
    'getOrders',
    'getProtectedFileURL',
    'grabOrder',
    'sendMessage'
  ]
  const approvedQuery = /role:\s*'mentor',\s*mentorStatus:\s*'approved'/

  for (const functionName of guardedFunctions) {
    assert.match(
      allRuntimeSourcesOf(functionName),
      approvedQuery,
      `${functionName} must require approval`
    )
  }
})

test('submitting an application stores pending student permissions only', () => {
  const source = sourceOf('submitMentorApplication')
  assert.match(source, /role:\s*'student'/)
  assert.match(source, /mentorStatus:\s*'pending'/)
  assert.doesNotMatch(source, /data:\s*\{[^}]*role:\s*'mentor'/s)
})
