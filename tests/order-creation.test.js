const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createAddOrderHandler } = require('../cloudfunctions/addOrder/handler')
const {
  MAX_DOCUMENT_BYTES,
  cloudFileMatchesDocumentPath,
  documentUploadPath,
  normalizeDocumentMetadata,
  remoteSizeFromHeaders
} = require('../cloudfunctions/addOrder/document-upload')
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

function addOrder(database, openid = 'student-openid', overrides = {}) {
  return createAddOrderHandler({
    getOpenid: async () => openid,
    createOrderId: createOrderDocumentId,
    getCloudFileSize: overrides.getCloudFileSize,
    now: () => Date.parse(database.clock),
    database: database,
    logger: silentLogger
  })
}

function documentEvent(requestId, cloudPath, fileSize = 2048) {
  return {
    requestId: requestId,
    typeText: '磨课坊',
    title: '小学语文 教案精修',
    price: 49,
    detail: {
      grade: '小学',
      subject: '语文',
      level: '高级教师',
      fileName: 'lesson-plan.docx',
      fileSize: fileSize,
      fileID: `cloud://test-env.example/${cloudPath}`
    }
  }
}

const ANALYSIS_TASK_ID = `ai_${'a'.repeat(32)}`
const ANALYSIS_FILE_ID = `cloud://test-env.example/zhenke/${ANALYSIS_TASK_ID}.mp4`

function diagnosisFixtures(overrides = {}) {
  return Object.assign(fixtures(), {
    aiTasks: [Object.assign({
      _id: ANALYSIS_TASK_ID,
      _openid: 'student-openid',
      status: 'done',
      fileID: ANALYSIS_FILE_ID,
      originalFileName: 'trusted-lesson.mp4',
      timeline: [{ time: '00:12', label: '导入', desc: '服务端分析结果' }]
    }, overrides)]
  })
}

function diagnosisEvent(requestId = 'diagnosis_request_0001') {
  return {
    requestId: requestId,
    typeText: '诊课室',
    title: '试讲视频 逐帧诊断',
    price: 128,
    detail: {
      analysisTaskId: ANALYSIS_TASK_ID,
      videoName: 'client-name.mp4',
      fileID: ANALYSIS_FILE_ID,
      aiTimeline: [{ time: '99:99', label: '伪造结果', desc: '不应保存' }]
    }
  }
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
  assert.match(adapterSource, /collection\('rateLimits'\)/)
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

test('anonymous question stores an alias, not the student profile name', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const result = await addOrder(database)({
    ...validEvent('anonymous_request_0001'),
    anonymous: true,
    title: '客户端伪造的私人姓名'
  })
  assert.equal(result.code, 0)
  const order = database.snapshot().orders[0]
  assert.equal(order.anonymous, true)
  assert.equal(order.title, '教育职场咨询')
  assert.equal(order.student, '匿名学员')
  assert.equal(order.studentAvatar, '匿')
  assert.doesNotMatch(JSON.stringify(order), /张同学|客户端伪造的私人姓名/)
})

test('document upload preparation returns a caller-scoped request path', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const firstHandler = addOrder(database)
  const otherHandler = addOrder(database, 'other-openid')
  const event = {
    action: 'prepare_document',
    requestId: 'document_request_0001',
    fileName: 'lesson-plan.DOCX',
    fileSize: 2048
  }

  const first = await firstHandler(event)
  const retry = await firstHandler(event)
  const otherCaller = await otherHandler(event)

  assert.equal(first.code, 0)
  assert.equal(first.data.cloudPath, retry.data.cloudPath)
  assert.notEqual(first.data.cloudPath, otherCaller.data.cloudPath)
  assert.match(first.data.cloudPath, /^moke\/doc_[a-f0-9]{32}\.docx$/)
  assert.doesNotMatch(first.data.cloudPath, /student-openid/)
})

test('document metadata and remote-size headers fail closed', () => {
  assert.equal(normalizeDocumentMetadata('lesson.pdf', 1).ok, true)
  assert.equal(normalizeDocumentMetadata('../lesson.pdf', 1).ok, false)
  assert.equal(normalizeDocumentMetadata('lesson.exe', 1).ok, false)
  assert.equal(normalizeDocumentMetadata('lesson.pdf', MAX_DOCUMENT_BYTES + 1).ok, false)
  assert.equal(remoteSizeFromHeaders(206, { 'content-range': 'bytes 0-0/2048' }), 2048)
  assert.equal(remoteSizeFromHeaders(200, { 'content-length': '4096' }), 4096)
  assert.equal(remoteSizeFromHeaders(206, { 'content-length': '1' }), 1)
  assert.equal(remoteSizeFromHeaders(500, {}), 0)
})

test('a document order accepts only its server-issued object and verified size', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const requestId = 'document_request_0002'
  const cloudPath = documentUploadPath('student-openid', requestId, 'docx')
  const seen = []
  const handler = addOrder(database, 'student-openid', {
    getCloudFileSize: async fileID => {
      seen.push(fileID)
      return 2048
    }
  })

  const result = await handler(documentEvent(requestId, cloudPath))
  const state = database.snapshot()

  assert.equal(result.code, 0)
  assert.equal(seen.length, 1)
  assert.equal(state.orders.length, 1)
  assert.equal(state.orders[0].detail.fileSize, 2048)
  assert.equal(cloudFileMatchesDocumentPath(seen[0], cloudPath), true)
})

test('a document order rejects unrelated paths and mismatched actual sizes', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const requestId = 'document_request_0003'
  const cloudPath = documentUploadPath('student-openid', requestId, 'docx')
  const handler = addOrder(database, 'student-openid', {
    getCloudFileSize: async () => 1024
  })

  const unrelated = await handler(documentEvent(requestId, `other/${cloudPath}`))
  const mismatched = await handler(documentEvent(requestId, cloudPath))

  assert.equal(unrelated.code, -1)
  assert.equal(mismatched.code, -1)
  assert.equal(database.snapshot().orders.length, 0)
})

test('replaying a document order skips another remote object check', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures())
  const requestId = 'document_request_0004'
  const cloudPath = documentUploadPath('student-openid', requestId, 'docx')
  let checks = 0
  const handler = addOrder(database, 'student-openid', {
    getCloudFileSize: async () => {
      checks += 1
      if (checks > 1) throw new Error('remote object is no longer available')
      return 2048
    }
  })

  const first = await handler(documentEvent(requestId, cloudPath))
  const retry = await handler(documentEvent(requestId, cloudPath))

  assert.equal(first.code, 0)
  assert.equal(retry.code, 0)
  assert.equal(retry.data.replayed, true)
  assert.equal(checks, 1)
  assert.equal(database.snapshot().orders.length, 1)
})

test('a diagnosis order trusts only the caller-owned completed analysis task', async () => {
  const database = new InMemoryOrderCreationDatabase(diagnosisFixtures())
  const result = await addOrder(database)(diagnosisEvent())
  const state = database.snapshot()

  assert.equal(result.code, 0)
  assert.equal(state.orders.length, 1)
  assert.equal(state.orders[0].detail.videoName, 'trusted-lesson.mp4')
  assert.deepEqual(state.orders[0].detail.aiTimeline, [
    { time: '00:12', label: '导入', desc: '服务端分析结果' }
  ])
  assert.equal(state.aiTasks[0].orderId, result.data._id)
})

test('a diagnosis task cannot be forged or consumed by two orders', async () => {
  const wrongOwner = new InMemoryOrderCreationDatabase(diagnosisFixtures({
    _openid: 'outsider-openid'
  }))
  assert.equal((await addOrder(wrongOwner)(diagnosisEvent())).code, -1)
  assert.equal(wrongOwner.snapshot().orders.length, 0)

  const database = new InMemoryOrderCreationDatabase(diagnosisFixtures())
  const handler = addOrder(database)
  assert.equal((await handler(diagnosisEvent('diagnosis_request_0001'))).code, 0)
  assert.equal((await handler(diagnosisEvent('diagnosis_request_0002'))).code, -1)
  assert.equal(database.snapshot().orders.length, 1)
  assert.equal(database.snapshot().users[0].balance, 72)
})

test('a confirmed diagnosis-order replay survives analysis-task cleanup', async () => {
  const database = new InMemoryOrderCreationDatabase(diagnosisFixtures())
  const handler = addOrder(database)
  const first = await handler(diagnosisEvent())
  database.aiTasks = []
  const replay = await handler(diagnosisEvent())

  assert.equal(first.code, 0)
  assert.equal(replay.code, 0)
  assert.equal(replay.data.replayed, true)
  assert.equal(database.snapshot().orders.length, 1)
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
  assert.equal(state.rateLimits[0].count, 1)
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
  assert.equal(state.rateLimits[0].count, 1)
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
  assert.equal(database.snapshot().rateLimits.length, 0)
})

test('the eleventh new order per caller per hour is rejected', async () => {
  const database = new InMemoryOrderCreationDatabase(fixtures(1000))
  const handler = addOrder(database)

  for (let index = 0; index < 10; index += 1) {
    const result = await handler(validEvent(`order_rate_request_${String(index).padStart(4, '0')}`))
    assert.equal(result.code, 0)
  }
  const rejected = await handler(validEvent('order_rate_request_0010'))
  const state = database.snapshot()
  assert.equal(rejected.code, -4)
  assert.equal(state.orders.length, 10)
  assert.equal(state.rateLimits[0].count, 10)
  assert.equal(state.users[0].balance, 710)
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

test('the document-order page uses the prepare, upload, and verified-submit flow', () => {
  const source = fs.readFileSync(path.join(root, 'pages', 'moke', 'moke.js'), 'utf8')

  assert.match(source, /action: 'prepare_document'/)
  assert.match(source, /cloudPath: prepared\.data\.cloudPath/)
  assert.match(source, /fileSize: this\.data\.fileSize/)
  assert.doesNotMatch(source, /cloudPath: 'moke\/' \+ Date\.now\(\)/)
})

test('the diagnosis page requires consent and submits the server analysis task ID', () => {
  const source = fs.readFileSync(path.join(root, 'pages', 'zhenke', 'zhenke.js'), 'utf8')
  const template = fs.readFileSync(path.join(root, 'pages', 'zhenke', 'zhenke.wxml'), 'utf8')

  assert.match(source, /consentVersion: VIDEO_PROCESSING_CONSENT_VERSION/)
  assert.match(source, /analysisTaskId: this\.data\.analysisTaskId/)
  assert.match(source, /this\.data\.aiStatus !== 2/)
  assert.doesNotMatch(source, /aiTimeline: this\.data\.aiTimeline/)
  assert.match(template, /bindchange="onVideoConsentChange"/)
  assert.match(template, /外部分析服务/)
})
