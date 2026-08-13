const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createCompleteOrderHandler } = require('../cloudfunctions/completeOrder/handler')
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

test('pending applicants cannot claim an order', async () => {
  const database = new InMemoryOrderDatabase(fixtures())
  const result = await grabOrder(database, 'pending-openid')({ orderId: 'open-order' })

  assert.equal(result.code, -3)
  assert.equal(database.snapshot().orders[0].status, 0)
  assert.equal(database.snapshot().conversations.length, 0)
})

test('an approved mentor atomically claims an order and creates two memberships', async () => {
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
