const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const authorization = require('../cloudfunctions/getProtectedFileURL/authorization')

test('database rules deny every direct client operation', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'security/database-rules.json'), 'utf8'))
  const expectedCollections = ['users', 'orders', 'messages', 'conversations', 'contents', 'aiTasks']

  assert.deepEqual(Object.keys(rules).sort(), expectedCollections.sort())
  for (const [collection, rule] of Object.entries(rules)) {
    assert.deepEqual(rule, { read: false, write: false }, `${collection} must be server-only`)
  }
})

test('storage rules permit direct access only to the file creator', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'security/storage-rules.json'), 'utf8'))
  const ownerExpression = 'resource.openid == auth.openid || resource.openid == auth.uid'

  assert.equal(rules.read, ownerExpression)
  assert.equal(rules.write, ownerExpression)
  assert.notEqual(rules.read, true)
  assert.notEqual(rules.write, true)
})

test('Mini Program pages do not bypass protected file authorization', () => {
  const pagesRoot = path.join(root, 'pages')
  const sources = []

  for (const page of fs.readdirSync(pagesRoot, { withFileTypes: true })) {
    if (!page.isDirectory()) continue
    const sourcePath = path.join(pagesRoot, page.name, `${page.name}.js`)
    if (fs.existsSync(sourcePath)) sources.push(fs.readFileSync(sourcePath, 'utf8'))
  }

  const clientSource = sources.join('\n')
  assert.doesNotMatch(clientSource, /wx\.cloud\.downloadFile\s*\(/)
  assert.doesNotMatch(clientSource, /wx\.cloud\.getTempFileURL\s*\(/)
  assert.doesNotMatch(clientSource, /wx\.cloud\.database\s*\(/)
})

test('order access is limited to the student or assigned mentor', () => {
  const order = { _openid: 'student-openid', teacherId: 'mentor-profile' }

  assert.equal(authorization.isOrderParticipant('student-openid', order, []), true)
  assert.equal(authorization.isOrderParticipant('mentor-openid', order, [
    { _id: 'mentor-profile', _openid: 'mentor-openid' }
  ]), true)
  assert.equal(authorization.isOrderParticipant('other-openid', order, [
    { _id: 'different-profile', _openid: 'other-openid' }
  ]), false)
})

test('voice access requires membership and a stored cloud file ID', () => {
  assert.equal(authorization.hasConversationMembership('member', [
    { _openid: 'member', conversationId: 'order_1' }
  ]), true)
  assert.equal(authorization.hasConversationMembership('outsider', [
    { _openid: 'member', conversationId: 'order_1' }
  ]), false)

  const fileID = 'cloud://example-env.voice/message.mp3'
  assert.equal(authorization.storedVoiceMatches(fileID, [
    { kind: 'voice', fileID: fileID }
  ]), true)
  assert.equal(authorization.storedVoiceMatches('https://example.com/file.mp3', [
    { kind: 'voice', fileID: 'https://example.com/file.mp3' }
  ]), false)
  assert.equal(authorization.storedVoiceMatches(fileID, [
    { kind: 'voice', fileID: 'cloud://example-env.voice/other.mp3' }
  ]), false)
})
