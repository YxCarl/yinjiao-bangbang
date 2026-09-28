const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const PREFIX = 'ybb_demo_v1_'
const START_TIME = Date.parse('2026-09-26T08:00:00.000Z')
const actors = ['student', 'otherStudent', 'mentor', 'otherMentor', 'pending']

function buildDemoFixtures(bindings = {}) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error('Invalid actor bindings')
  if (Object.keys(bindings).some(key => !actors.includes(key))) throw new Error('Unknown actor binding')
  const owner = {}
  for (const actor of actors) {
    const value = bindings[actor] === undefined ? `SYNTHETIC_ONLY_${actor}` : bindings[actor]
    if (typeof value !== 'string' || !value.trim() || value.length > 128) throw new Error('Invalid actor binding')
    owner[actor] = value
  }
  if (new Set(Object.values(owner)).size !== actors.length) throw new Error('Actors must have different identities')
  const id = value => PREFIX + value
  const date = offset => new Date(START_TIME + offset * 1000)
  const users = actors.map(actor => ({
    _id: id(actor), _openid: owner[actor], fixtureSet: PREFIX,
    name: `合成测试账号 ${actor}`, avatar: '测', balance: 1000,
    role: ['mentor', 'otherMentor'].includes(actor) ? 'mentor' : 'student',
    mentorStatus: ['mentor', 'otherMentor'].includes(actor) ? 'approved' : actor === 'pending' ? 'pending' : 'not_requested'
  }))
  const orders = []
  function addOrder(key, actor, mentor, status, anonymous = false, offset = 0) {
    const order = {
      _id: id(key), _openid: owner[actor], studentId: id(actor), fixtureSet: PREFIX,
      typeText: '问诊室', title: '教育职场咨询', anonymous,
      student: anonymous ? '匿名学员' : `合成测试账号 ${actor}`,
      studentAvatar: anonymous ? '匿' : '测', status, price: 29,
      desc: '合成测试问题：如何组织一节演示课堂？',
      detail: { content: '合成测试问题：如何组织一节演示课堂？' },
      createTime: date(offset)
    }
    if (mentor) Object.assign(order, { teacherId: id(mentor), teacher: `合成测试账号 ${mentor}`, claimTime: date(offset + 1) })
    if (status === 2) order.completeTime = date(offset + 2)
    orders.push(order)
    return order
  }
  addOrder('open_question', 'student', null, 0, false, 220)
  const anonymous = addOrder('anonymous_question', 'student', 'mentor', 1, true, 200)
  addOrder('other_mentor_question', 'otherStudent', 'otherMentor', 1, false, 20)
  addOrder('completed_question', 'student', 'mentor', 2, false, 30)
  for (let index = 0; index < 52; index += 1) {
    addOrder(`history_${String(index).padStart(3, '0')}`, 'student', 'mentor', 1, false, 100 + index)
  }
  const conversations = []
  for (const order of orders.filter(item => item.status !== 0)) {
    const mentor = users.find(user => user._id === order.teacherId)
    for (const role of ['student', 'mentor']) {
      conversations.push({
        _id: id(`${role}_conversation_${order._id.slice(PREFIX.length)}`),
        _openid: role === 'student' ? order._openid : mentor._openid,
        fixtureSet: PREFIX, conversationId: 'order_' + order._id, participantRole: role,
        peerName: role === 'student' ? mentor.name : order.student,
        orderTitle: order.title, unread: 0, lastMsg: '合成测试会话', lastTime: order.claimTime
      })
    }
  }
  const messages = Array.from({ length: 65 }, (_, index) => ({
    _id: id(`message_${String(index).padStart(3, '0')}`),
    _openid: index % 2 ? owner.mentor : owner.student,
    fixtureSet: PREFIX, conversationId: 'order_' + anonymous._id,
    kind: 'text', content: `合成测试消息 ${index + 1}：用于验证历史分页。`,
    fileID: '', dur: 0, createTime: date(300 + Math.floor(index / 3))
  }))
  for (const conversation of conversations.filter(item => item.conversationId === 'order_' + anonymous._id)) {
    conversation.lastTime = messages[messages.length - 1].createTime
    conversation.lastMsg = messages[messages.length - 1].content
  }
  const contents = [{
    _id: id('content'), fixtureSet: PREFIX, type: 'doc', title: '合成教案目录',
    desc: '仅用于验证资源列表与搜索，不含真实教学资料。', sort: 1, tags: ['合成数据'], chapters: ['示例条目'], fileID: ''
  }]
  return { users, orders, conversations, messages, contents, aiTasks: [], rateLimits: [] }
}

function toExtendedJson(value) {
  if (value instanceof Date) return { $date: value.toISOString() }
  if (Array.isArray(value)) return value.map(toExtendedJson)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toExtendedJson(item)]))
  return value
}

function writeFixtures(output, fixtures) {
  const outputs = path.join(projectRoot, 'outputs')
  const target = path.resolve(output)
  const relative = path.relative(outputs, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || /^[cC]:/.test(target)) {
    throw new Error('Output must be a new child directory under this project outputs folder, never C:')
  }
  if (fs.existsSync(target)) throw new Error('Output already exists; choose a new directory')
  fs.mkdirSync(outputs, { recursive: true })
  // Reject junctions/symlinks before writing potentially private test bindings.
  if (fs.realpathSync(outputs).toLowerCase() !== path.resolve(outputs).toLowerCase()) throw new Error('Output junctions are not supported')
  if (path.dirname(target) !== outputs) throw new Error('Use a direct child of the outputs folder')
  fs.mkdirSync(target)
  const manifest = { fixtureSet: PREFIX, collections: {} }
  for (const [name, records] of Object.entries(fixtures)) {
    manifest.collections[name] = records.map(record => record._id)
    if (records.length) {
      const lines = records.map(record => JSON.stringify(toExtendedJson(record))).join('\n') + '\n'
      fs.writeFileSync(path.join(target, `${name}.jsonl`), lines, { flag: 'wx' })
    }
  }
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
  return target
}

function main(args) {
  let write = false
  let output = path.join(projectRoot, 'outputs', 'demo-fixtures-v1')
  let bindings = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--write') write = true
    else if (arg === '--output' && args[index + 1]) output = path.resolve(args[++index])
    else if (arg === '--bindings' && args[index + 1]) bindings = JSON.parse(fs.readFileSync(args[++index], 'utf8'))
    else throw new Error('Usage: node scripts/generate-demo-fixtures.js [--write] [--output <new outputs child>] [--bindings <private JSON>]')
  }
  const fixtures = buildDemoFixtures(bindings)
  console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', counts: Object.fromEntries(Object.entries(fixtures).map(([name, records]) => [name, records.length])) }))
  if (write) console.log(`Created fixtures: ${writeFixtures(output, fixtures)}`)
  else console.log('Dry run only. Use --write to generate local files. No cloud operations are performed.')
}

if (require.main === module) {
  try { main(process.argv.slice(2)) }
  catch (error) { console.error(error instanceof SyntaxError ? 'Invalid bindings JSON' : error.message); process.exitCode = 1 }
}

module.exports = { buildDemoFixtures, toExtendedJson, writeFixtures, PREFIX }
