const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createAddOrderHandler } = require('../cloudfunctions/addOrder/handler')
const { createOrderDocumentId } = require('../cloudfunctions/addOrder/order-id')
const {
  beginOrderRequest,
  createOrderRequestId,
  finishOrderRequest
} = require('../utils/order-request')
const { InMemoryOrderCreationDatabase } = require('./in-memory-order-creation-database')

const root = path.resolve(__dirname, '..')
const silentLogger = { error() {} }

function fixtures(balance = 200) {
  return {
    users: [{
      _id: 'student-profile',
      _openid: 'student-openid',
      role: 'student',
      name: '张同学',
      balance: balance
    }]
  }
}

function validEvent(requestId = 'order_request_0001') {
  return {
    requestId: requestId,
    typeText: '问诊室',
    title: '教育职场咨询',
    price: 29,
    detail: { content: '这是一段足够具体的咨询内容' }
  }
}

function addOrder(database, openid = 'student-openid') {
  return createAddOrderHandler({
    getOpenid: async () => openid,
    createOrderId: createOrderDocumentId,
    database: database,
    logger: silentLogger
  })
}

test('addOrder deploys the dependency-injected transactional handler', () => {
  const entrySource = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'addOrder', 'index.js'),
    'utf8'
  )
  const adapterSource = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'addOrder', 'cloud-database-adapter.js'),
    'utf8'
  )

  assert.match(entrySource, /exports\.main = createAddOrderHandler\(/)
  assert.match(
    entrySource,
    /createCloudDatabaseAdapter\(cloud\.database\(\{ throwOnNotFound: false \}\)\)/
  )
  assert.match(adapterSource, /db\.runTransaction\(/)
  assert.match(adapterSource, /userReference\.update\(/)
  assert.match(adapterSource, /orderReference\.set\(/)
})

test('order document IDs are stable per caller and request without exposing OPENID', () => {
  const first = createOrderDocumentId('student-openid', 'order_request_0001')
  const retry = createOrderDocumentId('student-openid', 'order_request_0001')
  const otherCaller = createOrderDocumentId('other-openid', 'order_request_0001')

  assert.equal(first, retry)
  assert.notEqual(first, otherCaller)
  assert.match(first, /^order_[a-f0-9]{32}$/)
  assert.doesNotMatch(first, /student-openid/)
})

test('an order and its simulated balance deduction commit together', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const result = await addOrder(database)(validEvent())
  const state = database.snapshot()

  assert.equal(result.code, 0)
  assert.equal(result.data.balance, 171)
  assert.equal(result.data.replayed, false)
  assert.equal(state.users[0].balance, 171)
  assert.equal(state.orders.length, 1)
  assert.equal(state.orders[0]._id, result.data._id)
  assert.equal(state.orders[0].requestId, 'order_request_0001')
})

test('replaying one request returns the existing order without charging twice', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const handler = addOrder(database)

  const first = await handler(validEvent())
  const retry = await handler(validEvent())
  const state = database.snapshot()

  assert.equal(first.code, 0)
  assert.equal(retry.code, 0)
  assert.equal(retry.data.replayed, true)
  assert.equal(retry.data._id, first.data._id)
  assert.equal(state.users[0].balance, 171)
  assert.equal(state.orders.length, 1)
})

test('insufficient balance creates no order and changes no balance', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures(10))
  const result = await addOrder(database)(validEvent())

  assert.equal(result.code, -2)
  assert.equal(database.snapshot().users[0].balance, 10)
  assert.equal(database.snapshot().orders.length, 0)
})

test('a simulated order-write failure rolls the balance change back', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  database.failAfterBalanceUpdate = true

  const result = await addOrder(database)(validEvent())
  assert.equal(result.code, -1)
  assert.equal(database.snapshot().users[0].balance, 200)
  assert.equal(database.snapshot().orders.length, 0)
})

test('a corrupted stored balance fails closed without creating an order', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures('not-a-number'))
  const result = await addOrder(database)(validEvent())

  assert.equal(result.code, -1)
  assert.equal(database.snapshot().users[0].balance, 'not-a-number')
  assert.equal(database.snapshot().orders.length, 0)
})

test('order validation rejects ambiguous prices and invalid request identifiers', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const handler = addOrder(database)

  assert.equal((await handler(validEvent('short'))).code, -1)
  assert.equal((await handler(Object.assign(validEvent(), { price: '29abc' }))).code, -1)
  assert.equal((await handler(Object.assign(validEvent(), { price: 29.999 }))).code, -1)
  assert.equal((await addOrder(database, '')(validEvent())).code, -2)
  assert.equal(database.snapshot().orders.length, 0)
})

test('order detail accepts only bounded public fields', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const event = validEvent()
  event.detail = {
    content: '问'.repeat(700),
    unknownPrivateField: '不得保存',
    aiTimeline: Array.from({ length: 120 }, (_, index) => ({
      time: `${index}:00`,
      label: '标签',
      desc: '说明'
    }))
  }

  assert.equal((await addOrder(database)(event)).code, 0)
  const detail = database.snapshot().orders[0].detail
  assert.equal(detail.content.length, 500)
  assert.equal(detail.aiTimeline.length, 100)
  assert.equal(detail.unknownPrivateField, undefined)
})

test('client request IDs survive ambiguous network failures but rotate after confirmation', () => {
  const page = {}
  const payload = { typeText: '问诊室', price: 29 }
  const first = beginOrderRequest(page, payload)

  assert.match(first, /^[A-Za-z0-9_-]{16,80}$/)
  assert.equal(beginOrderRequest(page, payload), '', 'double tap is ignored while in flight')

  finishOrderRequest(page, false)
  assert.equal(beginOrderRequest(page, payload), first, 'network retry reuses the request ID')

  finishOrderRequest(page, false)
  const changed = beginOrderRequest(page, { typeText: '问诊室', price: 39 })
  assert.notEqual(changed, first, 'changed input receives a new request ID')

  finishOrderRequest(page, true)
  assert.notEqual(beginOrderRequest(page, { typeText: '问诊室', price: 39 }), changed)
  assert.match(createOrderRequestId(), /^[A-Za-z0-9_-]{16,80}$/)
})

test('all three order pages send requestId and handle nonzero function results', () => {
  for (const page of ['moke', 'wenzhen', 'zhenke']) {
    const source = fs.readFileSync(path.join(root, 'pages', page, `${page}.js`), 'utf8')
    assert.match(source, /beginOrderRequest\(this,/)
    assert.match(source, /requestId/)
    assert.match(source, /result\.code !== 0/)
    assert.match(source, /finishOrderRequest\(this, false\)/)
  }
})
