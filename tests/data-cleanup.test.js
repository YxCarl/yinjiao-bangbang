const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  createCleanupExpiredDataHandler,
  normalizedBatchSize
} = require('../cloudfunctions/cleanupExpiredData/handler')

const root = path.resolve(__dirname, '..')
const nowMs = Date.UTC(2026, 7, 16, 3, 0, 0)
const silentLogger = { error() {} }

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryCleanupDatabase {
  constructor(fixtures = {}) {
    this.tasks = clone(fixtures.tasks || [])
    this.rateLimits = clone(fixtures.rateLimits || [])
    this.listCalls = 0
  }

  async listExpiredAiTasks(timestamp, limit) {
    this.listCalls += 1
    return clone(this.tasks.filter(task => (
      task.cleanupEligible === true && Date.parse(task.expiresAt) <= timestamp
    )).slice(0, limit))
  }

  async claimExpiredAiTask(taskId, timestamp) {
    const task = this.tasks.find(item => item._id === taskId)
    if (
      !task ||
      task.cleanupEligible !== true ||
      task.orderId ||
      Date.parse(task.expiresAt) > timestamp
    ) return null
    task.cleanupEligible = false
    task.cleanupState = 'deleting'
    return clone(task)
  }

  async removeClaimedAiTask(taskId) {
    const index = this.tasks.findIndex(task => (
      task._id === taskId && task.cleanupState === 'deleting'
    ))
    if (index < 0) return false
    this.tasks.splice(index, 1)
    return true
  }

  async releaseCleanupClaim(taskId) {
    const task = this.tasks.find(item => item._id === taskId)
    if (!task) return
    task.cleanupEligible = true
    task.cleanupState = 'retry'
  }

  async markTaskForManualReview(taskId, timestamp, reason) {
    const task = this.tasks.find(item => item._id === taskId)
    if (!task) return
    task.cleanupEligible = false
    task.cleanupState = 'manual-review'
    task.cleanupReviewedAtMs = timestamp
    task.cleanupReason = reason
  }

  async deleteExpiredRateLimits(timestamp, limit) {
    const expired = this.rateLimits
      .filter(item => Date.parse(item.expiresAt) <= timestamp)
      .slice(0, limit)
    const expiredIds = new Set(expired.map(item => item._id))
    this.rateLimits = this.rateLimits.filter(item => !expiredIds.has(item._id))
    return expired.length
  }
}

function handlerFor(options = {}) {
  const database = options.database || new InMemoryCleanupDatabase()
  const deletedFiles = []
  const handler = createCleanupExpiredDataHandler({
    isEnabled: () => options.enabled === true,
    now: () => nowMs,
    database: database,
    deleteCloudFile: async fileID => {
      deletedFiles.push(fileID)
      return options.deleteResult !== false
    },
    logger: silentLogger
  })
  return { database, deletedFiles, handler }
}

function expiredTask(id, overrides = {}) {
  return Object.assign({
    _id: id,
    cleanupEligible: true,
    cleanupState: 'scheduled',
    expiresAt: new Date(nowMs - 1000).toISOString(),
    fileID: `cloud://example.env/zhenke/${id}.mp4`
  }, overrides)
}

test('cleanup deploys as a disabled-by-default daily timer function', () => {
  const entry = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'cleanupExpiredData', 'index.js'),
    'utf8'
  )
  const config = JSON.parse(fs.readFileSync(
    path.join(root, 'cloudfunctions', 'cleanupExpiredData', 'config.json'),
    'utf8'
  ))

  assert.match(entry, /DATA_CLEANUP_ENABLED === 'true'/)
  assert.match(entry, /cloud\.deleteFile\(/)
  assert.equal(config.triggers[0].type, 'timer')
  assert.equal(config.triggers[0].config, '0 0 3 * * * *')
})

test('disabled cleanup performs no database reads or writes', async () => {
  const harness = handlerFor()
  const result = await harness.handler({ Type: 'Timer' })

  assert.equal(result.code, 0)
  assert.equal(result.data.status, 'disabled')
  assert.equal(harness.database.listCalls, 0)
})

test('dry run reports a bounded candidate count without mutation', async () => {
  const database = new InMemoryCleanupDatabase({
    tasks: [expiredTask('expired-1'), expiredTask('expired-2')]
  })
  const harness = handlerFor({ database: database })
  const result = await harness.handler({ dryRun: true, batchSize: 500 })

  assert.equal(result.code, 0)
  assert.equal(result.data.status, 'dry-run')
  assert.equal(result.data.expiredAiTasks, 2)
  assert.equal(result.data.batchSize, 50)
  assert.equal(database.tasks.length, 2)
  assert.equal(harness.deletedFiles.length, 0)
  assert.equal(normalizedBatchSize('invalid'), 20)
})

test('timer cleanup deletes only expired unbound files and expired rate counters', async () => {
  const database = new InMemoryCleanupDatabase({
    tasks: [
      expiredTask('delete-me'),
      expiredTask('manual-review', { fileID: '' }),
      expiredTask('order-bound', { orderId: 'order_1' }),
      expiredTask('future', { expiresAt: new Date(nowMs + 1000).toISOString() })
    ],
    rateLimits: [
      { _id: 'rate-1', expiresAt: new Date(nowMs - 1000).toISOString() },
      { _id: 'rate-2', expiresAt: new Date(nowMs - 500).toISOString() },
      { _id: 'rate-future', expiresAt: new Date(nowMs + 1000).toISOString() }
    ]
  })
  const harness = handlerFor({ database: database, enabled: true })
  const result = await harness.handler({ Type: 'Timer' })

  assert.equal(result.code, 0)
  assert.deepEqual(result.data, {
    status: 'completed',
    claimedAiTasks: 2,
    deletedAiTasks: 1,
    manualReviewTasks: 1,
    failedAiTasks: 0,
    deletedRateLimits: 2
  })
  assert.equal(harness.deletedFiles.length, 1)
  assert.equal(database.tasks.some(task => task._id === 'delete-me'), false)
  assert.equal(database.tasks.find(task => task._id === 'manual-review').cleanupState, 'manual-review')
  assert.equal(database.tasks.find(task => task._id === 'order-bound').cleanupState, 'scheduled')
  assert.deepEqual(database.rateLimits.map(item => item._id), ['rate-future'])
})

test('storage failure releases the task for a later retry', async () => {
  const database = new InMemoryCleanupDatabase({ tasks: [expiredTask('retry-me')] })
  const harness = handlerFor({ database: database, enabled: true, deleteResult: false })
  const result = await harness.handler({ Type: 'Timer' })

  assert.equal(result.code, 0)
  assert.equal(result.data.failedAiTasks, 1)
  assert.equal(database.tasks[0].cleanupEligible, true)
  assert.equal(database.tasks[0].cleanupState, 'retry')
})

test('enabled cleanup rejects non-timer mutation attempts', async () => {
  const harness = handlerFor({ enabled: true })
  const result = await harness.handler({})

  assert.equal(result.code, -3)
  assert.equal(harness.database.listCalls, 0)
})
