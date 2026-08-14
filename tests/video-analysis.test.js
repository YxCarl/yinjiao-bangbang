const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createAnalyzeVideoHandler } = require('../cloudfunctions/analyzeVideo/handler')
const {
  completionBody,
  interpretAsyncResult,
  remoteSizeFromHeaders
} = require('../cloudfunctions/analyzeVideo/provider')
const {
  MAX_VIDEO_BYTES,
  PROCESSING_TIMEOUT_MS,
  createTaskId,
  parseTimeline
} = require('../cloudfunctions/analyzeVideo/policy')
const { InMemoryAiTaskDatabase } = require('./in-memory-ai-task-database')

const root = path.resolve(__dirname, '..')
const silentLogger = { error() {} }
const initialTime = Date.UTC(2026, 7, 14, 16, 0, 0)

function prepareEvent(requestId = 'video_request_0001') {
  return {
    action: 'prepare',
    requestId: requestId,
    fileName: 'lesson.mp4',
    fileSize: 20 * 1024 * 1024,
    durationSeconds: 180
  }
}

function fakeProvider(options = {}) {
  return {
    calls: 0,
    resultCalls: 0,
    isConfigured() {
      return options.configured !== false
    },
    async submit() {
      this.calls += 1
      if (options.error) throw options.error
      return 'provider-task-1'
    },
    async getResult() {
      this.resultCalls += 1
      if (options.resultError) throw options.resultError
      return options.result || {
        status: 'done',
        timeline: options.timeline || [
          { time: '00:10', label: '导入', desc: '提出问题' },
          { time: '03:20', label: '讲解', desc: '解释概念' }
        ]
      }
    }
  }
}

function createHarness(options = {}) {
  const database = options.database || new InMemoryAiTaskDatabase()
  const provider = options.provider || fakeProvider()
  const clock = options.clock || { value: initialTime }
  const handler = createAnalyzeVideoHandler({
    getOpenid: async () => options.openid === undefined ? 'student-openid' : options.openid,
    now: () => clock.value,
    database: database,
    provider: provider,
    getTempFileUrl: async () => 'https://temp.example/video.mp4',
    logger: silentLogger
  })
  return { database, provider, clock, handler }
}

test('analyzeVideo deploys a bounded asynchronous handler and transaction adapter', () => {
  const entry = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'analyzeVideo', 'index.js'),
    'utf8'
  )
  const adapter = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'analyzeVideo', 'cloud-database-adapter.js'),
    'utf8'
  )
  const provider = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'analyzeVideo', 'provider.js'),
    'utf8'
  )

  assert.match(entry, /exports\.main = createAnalyzeVideoHandler\(/)
  assert.match(entry, /throwOnNotFound: false/)
  assert.match(adapter, /db\.runTransaction\(/)
  assert.match(adapter, /collection\('rateLimits'\)/)
  assert.match(provider, /request\.setTimeout\(/)
  assert.match(provider, /MAX_RESPONSE_BYTES/)
  assert.match(provider, /Range: 'bytes=0-0'/)
  assert.match(provider, /\/api\/paas\/v4\/async\/chat\/completions/)
  assert.match(provider, /\/api\/paas\/v4\/async-result\//)
  assert.doesNotMatch(entry, /analyzeAsync\([^)]*\)\.catch/)
})

test('provider submission carries a deterministic request ID and video URL', () => {
  const body = completionBody('glm-4v-plus', 'https://temp.example/video.mp4', 'ai_task_1')
  assert.equal(body.request_id, 'ai_task_1')
  assert.equal(body.model, 'glm-4v-plus')
  assert.equal(body.messages[0].content[0].video_url.url, 'https://temp.example/video.mp4')
})

test('provider async results distinguish processing, failure, and completion', () => {
  assert.deepEqual(interpretAsyncResult({ task_status: 'PROCESSING' }, parseTimeline), {
    status: 'processing'
  })
  assert.deepEqual(interpretAsyncResult({ task_status: 'FAIL' }, parseTimeline), {
    status: 'error'
  })
  assert.deepEqual(interpretAsyncResult({
    task_status: 'SUCCESS',
    choices: [{ message: { content: '[{"time":"00:05","label":"导入","desc":"提问"}]' } }]
  }, parseTimeline), {
    status: 'done',
    timeline: [{ time: '00:05', label: '导入', desc: '提问' }]
  })
})

test('remote object size parsing prefers Content-Range totals', () => {
  assert.equal(remoteSizeFromHeaders(206, {
    'content-range': 'bytes 0-0/10485760',
    'content-length': '1'
  }), 10485760)
  assert.equal(remoteSizeFromHeaders(200, { 'content-length': '2048' }), 2048)
  assert.equal(remoteSizeFromHeaders(200, {}), 0)
})

test('task preparation requires login, provider configuration, and bounded metadata', async () => {
  assert.equal((await createHarness({ openid: '' }).handler(prepareEvent())).code, -2)
  assert.equal((await createHarness({ provider: fakeProvider({ configured: false }) })
    .handler(prepareEvent())).code, -2)

  const harness = createHarness()
  assert.equal((await harness.handler(Object.assign(prepareEvent(), {
    fileSize: MAX_VIDEO_BYTES
  }))).code, -1)
  assert.equal((await harness.handler(Object.assign(prepareEvent(), {
    durationSeconds: 601
  }))).code, -1)
  assert.equal((await harness.handler(Object.assign(prepareEvent(), {
    fileName: 'lesson.exe'
  }))).code, -1)
  assert.equal(harness.database.snapshot().tasks.length, 0)
})

test('preparation is idempotent and limits each caller to three new tasks per hour', async () => {
  const harness = createHarness()
  const first = await harness.handler(prepareEvent('video_request_0001'))
  const replay = await harness.handler(prepareEvent('video_request_0001'))

  assert.equal(first.code, 0)
  assert.equal(replay.code, 0)
  assert.equal(replay.data.taskId, first.data.taskId)
  assert.equal(harness.database.snapshot().tasks.length, 1)
  assert.equal(harness.database.snapshot().rateLimits[0].count, 1)

  assert.equal((await harness.handler(prepareEvent('video_request_0002'))).code, 0)
  assert.equal((await harness.handler(prepareEvent('video_request_0003'))).code, 0)
  assert.equal((await harness.handler(prepareEvent('video_request_0004'))).code, -4)
  assert.equal(harness.database.snapshot().tasks.length, 3)
  assert.equal(harness.database.snapshot().rateLimits[0].count, 3)
})

test('task status reveals no owner or file metadata and rejects another caller', async () => {
  const database = new InMemoryAiTaskDatabase()
  const owner = createHarness({ database: database })
  const prepared = await owner.handler(prepareEvent())
  const taskId = prepared.data.taskId

  const ownerStatus = await owner.handler({ action: 'status', taskId: taskId })
  assert.equal(ownerStatus.code, 0)
  assert.equal(ownerStatus.data.status, 'awaiting_upload')
  assert.equal(ownerStatus.data._openid, undefined)
  assert.equal(ownerStatus.data.fileID, undefined)

  const outsider = createHarness({ database: database, openid: 'outsider-openid' })
  assert.equal((await outsider.handler({ action: 'status', taskId: taskId })).code, -3)
})

test('analysis starts only for the server-issued upload path and submits once', async () => {
  const harness = createHarness()
  const prepared = await harness.handler(prepareEvent())
  const taskId = prepared.data.taskId

  assert.equal((await harness.handler({
    action: 'start',
    taskId: taskId,
    fileID: 'cloud://example.bucket/zhenke/unrelated.mp4'
  })).code, -3)
  assert.equal(harness.provider.calls, 0)

  const fileID = `cloud://example.bucket/${prepared.data.cloudPath}`
  const started = await harness.handler({ action: 'start', taskId: taskId, fileID: fileID })
  const replay = await harness.handler({ action: 'start', taskId: taskId, fileID: fileID })
  const completed = await harness.handler({ action: 'status', taskId: taskId })

  assert.equal(started.code, 0)
  assert.equal(started.data.status, 'processing')
  assert.equal(started.data.providerTaskId, undefined)
  assert.equal(replay.code, 0)
  assert.equal(replay.data.status, 'processing')
  assert.equal(completed.data.status, 'done')
  assert.equal(harness.provider.calls, 1)
  assert.equal(harness.provider.resultCalls, 1)
})

test('pending and transient provider status responses keep tasks processing', async () => {
  const pending = createHarness({
    provider: fakeProvider({ result: { status: 'processing' } })
  })
  const prepared = await pending.handler(prepareEvent())
  const fileID = `cloud://example.bucket/${prepared.data.cloudPath}`
  await pending.handler({ action: 'start', taskId: prepared.data.taskId, fileID: fileID })
  assert.equal((await pending.handler({
    action: 'status', taskId: prepared.data.taskId
  })).data.status, 'processing')

  const transient = new Error('temporary provider outage')
  transient.code = 'PROVIDER_TIMEOUT'
  pending.provider.getResult = async () => { throw transient }
  assert.equal((await pending.handler({
    action: 'status', taskId: prepared.data.taskId
  })).data.status, 'processing')
})

test('provider failures and stale processing tasks fail closed with public errors', async () => {
  const failure = new Error('secret provider detail')
  failure.code = 'PROVIDER_TIMEOUT'
  const harness = createHarness({ provider: fakeProvider({ error: failure }) })
  const prepared = await harness.handler(prepareEvent())
  const fileID = `cloud://example.bucket/${prepared.data.cloudPath}`
  const result = await harness.handler({
    action: 'start',
    taskId: prepared.data.taskId,
    fileID: fileID
  })

  assert.equal(result.code, -1)
  assert.equal(harness.database.snapshot().tasks[0].status, 'error')
  assert.doesNotMatch(harness.database.snapshot().tasks[0].error, /secret/)

  const staleDatabase = new InMemoryAiTaskDatabase()
  const stale = createHarness({ database: staleDatabase })
  const stalePrepared = await stale.handler(prepareEvent('video_request_stale'))
  const staleTask = staleDatabase.tasks[0]
  staleTask.status = 'processing'
  staleTask.startedAtMs = initialTime
  stale.clock.value = initialTime + PROCESSING_TIMEOUT_MS + 1

  const staleStatus = await stale.handler({
    action: 'status',
    taskId: stalePrepared.data.taskId
  })
  assert.equal(staleStatus.data.status, 'error')
  assert.equal(staleStatus.data.error, 'AI 分析超时')
})

test('provider timeline parsing accepts JSON or markdown and bounds output', () => {
  const markdown = '```json\n[{"time":"00:01","label":"导入","desc":"开始"}]\n```'
  assert.deepEqual(parseTimeline(markdown), [
    { time: '00:01', label: '导入', desc: '开始' }
  ])

  const oversized = JSON.stringify(Array.from({ length: 120 }, (_, index) => ({
    time: `00:${String(index % 60).padStart(2, '0')}`,
    label: '标'.repeat(150),
    desc: '述'.repeat(700)
  })))
  const timeline = parseTimeline(oversized)
  assert.equal(timeline.length, 100)
  assert.equal(timeline[0].label.length, 100)
  assert.equal(timeline[0].desc.length, 500)
})

test('task IDs are caller-scoped and the video page uses prepare-upload-start-status', () => {
  assert.equal(
    createTaskId('student-openid', 'video_request_0001'),
    createTaskId('student-openid', 'video_request_0001')
  )
  assert.notEqual(
    createTaskId('student-openid', 'video_request_0001'),
    createTaskId('outsider-openid', 'video_request_0001')
  )

  const page = fs.readFileSync(path.join(root, 'pages', 'zhenke', 'zhenke.js'), 'utf8')
  assert.match(page, /action: 'prepare'/)
  assert.match(page, /cloudPath: cloudPath/)
  assert.match(page, /action: 'start'/)
  assert.match(page, /action: 'status'/)
  assert.match(page, /createRequestId\('video'\)/)
  assert.match(page, /ACTIVE_ANALYSIS_TASK_KEY/)
  assert.match(page, /onLoad\(\)/)
})
