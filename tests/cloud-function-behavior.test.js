const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { createCompleteOrderHandler } = require('../cloudfunctions/completeOrder/handler')
const { createCloudDatabaseAdapter: createOrderListAdapter } = require('../cloudfunctions/getOrders/cloud-database-adapter')
const { createGetOrdersHandler } = require('../cloudfunctions/getOrders/handler')
const { createGrabOrderHandler } = require('../cloudfunctions/grabOrder/handler')
const { InMemoryOrderDatabase } = require('./in-memory-order-database')

const root = path.resolve(__dirname, '..')
const silentLogger = { error() {} }

function fixtures() {
  return {
    users: [
      { _id: 'student-profile', _openid: 'student-openid', role: 'student' },
      {
        _id: 'pending-profile',
        _openid: 'pending-openid',
        role: 'student',
        mentorStatus: 'pending'
      },
      {
        _id: 'mentor-profile',
        _openid: 'mentor-openid',
        role: 'mentor',
        mentorStatus: 'approved',
        name: '李老师',
        avatar: '李'
      },
      {
        _id: 'other-mentor-profile',
        _openid: 'other-mentor-openid',
        role: 'mentor',
        mentorStatus: 'approved',
        name: '王老师'
      }
    ],
    orders: [
      {
        _id: 'open-order',
        _openid: 'student-openid',
        student: '张同学',
        title: '教案精修',
        status: 0,
        createTime: '2026-08-13T10:00:00.000Z'
      },
      {
        _id: 'older-order',
        _openid: 'another-student-openid',
        student: '赵同学',
        title: '试讲复盘',
        status: 0,
        createTime: '2026-08-12T10:00:00.000Z'
      }
    ]
  }
}

function getOrders(database, openid) {
  return createGetOrdersHandler({
    getOpenid: async () => openid,
    database: database,
    logger: silentLogger
  })
}

function grabOrder(database, openid) {
  return createGrabOrderHandler({
    getOpenid: async () => openid,
    database: database,
    logger: silentLogger
  })
}

function completeOrder(database, openid) {
  return createCompleteOrderHandler({
    getOpenid: async () => openid,
    database: database,
    logger: silentLogger
  })
}

test('deployed entry points export the dependency-injected handlers', () => {
  const expected = {
    completeOrder: 'createCompleteOrderHandler',
    getOrders: 'createGetOrdersHandler',
    grabOrder: 'createGrabOrderHandler'
  }

  for (const [functionName, factoryName] of Object.entries(expected)) {
    const source = fs.readFileSync(
      path.join(root, 'cloudfunctions', functionName, 'index.js'),
      'utf8'
    )
    assert.match(source, new RegExp(`exports\\.main = ${factoryName}\\(`))
    assert.match(source, /createCloudDatabaseAdapter\(cloud\.database\(\)\)/)
  }
})

test('only an approved mentor can list the demand hall', async () => {
  const database = new InMemoryOrderDatabase(fixtures())

  assert.equal((await getOrders(database, 'student-openid')({ scope: 'all' })).code, -3)
  assert.equal((await getOrders(database, 'pending-openid')({ scope: 'all' })).code, -3)

  const result = await getOrders(database, 'mentor-openid')({ scope: 'all' })
  assert.equal(result.code, 0)
  assert.deepEqual(result.data.map(order => order._id), ['open-order', 'older-order'])
})

test('students can list only their own orders', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  const result = await getOrders(database, 'student-openid')({ scope: 'mine' })

  assert.equal(result.code, 0)
  assert.deepEqual(result.data.map(order => order._id), ['open-order'])
})

test('mentor demand hall hides unclaimed details and other mentors assigned orders', async () => {
  const data = fixtures()
  data.orders[0].title = '张同学的私密教案'
  data.orders[0].desc = '含有不应公开的课堂详情'
  data.orders[0].detail = { fileID: 'cloud://private/file.pdf', aiTimeline: [{ desc: '隐私' }] }
  data.orders.push({
    _id: 'assigned-elsewhere',
    _openid: 'another-student-openid',
    teacherId: 'other-mentor-profile',
    status: 1,
    title: '其他导师的订单',
    detail: { content: '不能泄露' },
    createTime: '2026-08-14T10:00:00.000Z'
  })
  const database = new InMemoryOrderDatabase(data)

  const firstMentor = await getOrders(database, 'mentor-openid')({ scope: 'all' })
  assert.deepEqual(firstMentor.data.map(order => order._id), ['open-order', 'older-order'])
  assert.deepEqual(Object.keys(firstMentor.data[0]).sort(), [
    '_id', 'createTime', 'desc', 'price', 'status', 'student', 'title', 'typeText'
  ].sort())
  assert.equal(firstMentor.data[0].student, '学员')
  assert.doesNotMatch(JSON.stringify(firstMentor.data), /张同学|私密教案|课堂详情|cloud:\/\/|aiTimeline|another-student-openid|其他导师/)

  const owner = await getOrders(database, 'student-openid')({ scope: 'mine' })
  assert.equal(owner.data[0].detail.fileID, 'cloud://private/file.pdf')

  await grabOrder(database, 'mentor-openid')({ orderId: 'open-order' })
  const assignedMentor = await getOrders(database, 'mentor-openid')({ scope: 'all' })
  assert.equal(assignedMentor.data.find(order => order._id === 'open-order').detail.fileID, 'cloud://private/file.pdf')
  assert.equal(assignedMentor.data.some(order => order._id === 'assigned-elsewhere'), false)
  assert.equal(JSON.stringify(assignedMentor.data).includes('student-openid'), false)
})

test('anonymous question hides the student name after claiming, including legacy title-marked orders', async () => {
  const data = fixtures()
  data.orders[0].typeText = '问诊室'
  data.orders[0].title = '【匿名】教育职场咨询'
  data.orders[0].anonymous = true
  data.orders[0].student = '张同学'
  data.orders[0].studentAvatar = '张'
  const database = new InMemoryOrderDatabase(data)

  assert.equal((await grabOrder(database, 'mentor-openid')({ orderId: 'open-order' })).code, 0)
  const mentor = await getOrders(database, 'mentor-openid')({ scope: 'all' })
  const own = await getOrders(database, 'student-openid')({ scope: 'mine' })
  const order = mentor.data.find(item => item._id === 'open-order')
  assert.equal(order.student, '匿名学员')
  assert.equal(order.studentAvatar, '匿')
  assert.equal(order.anonymous, true)
  assert.equal(own.data[0].student, '张同学')
  assert.equal(database.snapshot().conversations.find(item => item.participantRole === 'mentor').peerName, '匿名学员')

  const legacy = fixtures()
  legacy.orders[0].typeText = '问诊室'
  legacy.orders[0].title = '【匿名】教育职场咨询'
  const legacyDatabase = new InMemoryOrderDatabase(legacy)
  await grabOrder(legacyDatabase, 'mentor-openid')({ orderId: 'open-order' })
  const legacyMentor = await getOrders(legacyDatabase, 'mentor-openid')({ scope: 'all' })
  assert.equal(legacyMentor.data.find(item => item._id === 'open-order').student, '匿名学员')
})

test('CloudBase order-list adapter filters by status or owner before limiting results', async () => {
  const filters = []
  const query = {
    where(filter) { filters.push(filter); return this },
    orderBy() { return this },
    limit() { return this },
    async get() { return { data: [] } }
  }
  const adapter = createOrderListAdapter({ collection() { return query } })
  await adapter.listOrders({ availableOnly: true, limit: 50 })
  await adapter.listOrders({ assignedMentorId: 'mentor-profile', limit: 50 })
  await adapter.listOrders({ ownerOpenid: 'student-openid', limit: 50 })
  assert.deepEqual(filters, [
    { status: 0 },
    { teacherId: 'mentor-profile' },
    { _openid: 'student-openid' }
  ])
  await assert.rejects(adapter.listOrders({ limit: 50 }), /scoped/)
})

test('mentor workspace shows a load error instead of actionable fake orders', () => {
  const source = fs.readFileSync(path.join(root, 'pages/teacher/teacher.js'), 'utf8')
  let definition
  let request
  const context = {
    Page(page) { definition = page },
    wx: {
      cloud: { callFunction(options) { request = options } },
      showToast() {}
    }
  }
  vm.runInNewContext(source, context)
  const page = {
    ...definition,
    data: { ...definition.data },
    setData(patch, callback) {
      Object.assign(this.data, patch)
      if (callback) callback()
    }
  }

  page.loadOrders()
  request.fail()
  assert.equal(page.data.loadError, true)
  assert.equal(page.data.orders.length, 0)
  assert.equal(page.data.totalOrders, 0)

  page.loadOrders()
  request.success({ result: { code: 0, data: [{ _id: 'open', status: 0, typeText: '磨课坊' }] } })
  assert.equal(page.data.loadError, false)
  assert.equal(page.data.orders.length, 1)
  assert.equal(page.data.totalOrders, 0, 'an open request is not an already guided order')

  page.loadOrders()
  request.success({ result: { code: 0, data: [
    { _id: 'open', status: 0, typeText: '磨课坊' },
    { _id: 'mine', status: 1, typeText: '问诊室' },
    { _id: 'done', status: 2, typeText: '诊课室' }
  ] } })
  assert.deepEqual(Array.from(page.data.filteredOrders, item => item._id), ['open'])
  page.switchTab({ currentTarget: { dataset: { index: '1' } } })
  assert.deepEqual(Array.from(page.data.filteredOrders, item => item._id), ['mine'])
  page.switchTab({ currentTarget: { dataset: { index: '2' } } })
  assert.deepEqual(Array.from(page.data.filteredOrders, item => item._id), ['done'])
})

test('pending applicants cannot claim an order', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  const result = await grabOrder(database, 'pending-openid')({ orderId: 'open-order' })

  assert.equal(result.code, -3)
  assert.equal(database.snapshot().orders[0].status, 0)
  assert.equal(database.snapshot().conversations.length, 0)
})

test('an approved mentor claims an order and creates two memberships', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  const handler = grabOrder(database, 'mentor-openid')

  const first = await handler({ orderId: 'open-order' })
  const second = await handler({ orderId: 'open-order' })
  const state = database.snapshot()

  assert.equal(first.code, 0)
  assert.equal(second.code, 0, 'retry by the assigned mentor is idempotent')
  assert.equal(state.orders[0].status, 1)
  assert.equal(state.orders[0].teacherId, 'mentor-profile')
  assert.equal(state.conversations.length, 2)
  assert.deepEqual(
    state.conversations.map(item => item.participantRole).sort(),
    ['mentor', 'student']
  )
})

test('a competing mentor cannot take an already assigned order', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  await grabOrder(database, 'mentor-openid')({ orderId: 'open-order' })

  const result = await grabOrder(database, 'other-mentor-openid')({ orderId: 'open-order' })
  assert.equal(result.code, -2)
  assert.equal(database.snapshot().orders[0].teacherId, 'mentor-profile')
})

test('an atomic claim conflict is reported without creating memberships', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  database.claimOpenOrder = async () => false

  const result = await grabOrder(database, 'mentor-openid')({ orderId: 'open-order' })
  assert.equal(result.code, -2)
  assert.equal(database.snapshot().conversations.length, 0)
})

test('only the assigned approved mentor can complete an active order', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  await grabOrder(database, 'mentor-openid')({ orderId: 'open-order' })

  assert.equal(
    (await completeOrder(database, 'pending-openid')({ orderId: 'open-order' })).code,
    -3
  )
  assert.equal(
    (await completeOrder(database, 'other-mentor-openid')({ orderId: 'open-order' })).code,
    -3
  )

  const result = await completeOrder(database, 'mentor-openid')({ orderId: 'open-order' })
  assert.equal(result.code, 0)
  assert.equal(database.snapshot().orders[0].status, 2)
  assert.equal(
    (await completeOrder(database, 'mentor-openid')({ orderId: 'open-order' })).code,
    -2
  )
})

test('an atomic completion conflict cannot report a false success', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  await grabOrder(database, 'mentor-openid')({ orderId: 'open-order' })
  database.completeAssignedOrder = async () => false

  const result = await completeOrder(database, 'mentor-openid')({ orderId: 'open-order' })
  assert.equal(result.code, -2)
  assert.equal(database.snapshot().orders[0].status, 1)
})
