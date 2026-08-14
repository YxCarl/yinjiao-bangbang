function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryAiTaskDatabase {
  constructor() {
    this.tasks = []
    this.rateLimits = []
    this.clock = '2026-08-14T16:00:00.000Z'
  }

  async prepareTask(input) {
    const existing = this.tasks.find(task => task._id === input.taskId)
    if (existing) {
      if (existing._openid !== input.openid || existing.requestId !== input.requestId) {
        const collision = new Error('Deterministic AI task ID collision')
        collision.code = 'AI_TASK_ID_COLLISION'
        throw collision
      }
      return { status: 'duplicate', task: clone(existing) }
    }

    let rate = this.rateLimits.find(item => item._id === input.rateLimitId)
    const currentCount = rate && rate.windowStartMs === input.windowStartMs
      ? Number(rate.count || 0)
      : 0
    if (currentCount >= input.maximumRequests) return { status: 'rate-limited' }

    if (!rate) {
      rate = { _id: input.rateLimitId }
      this.rateLimits.push(rate)
    }
    Object.assign(rate, {
      _openid: input.openid,
      scope: 'analyzeVideo',
      windowStartMs: input.windowStartMs,
      count: currentCount + 1,
      expiresAt: new Date(input.rateLimitExpiresAtMs).toISOString()
    })

    const task = {
      _id: input.taskId,
      _openid: input.openid,
      requestId: input.requestId,
      status: 'awaiting_upload',
      expectedCloudPath: input.expectedCloudPath,
      originalFileName: input.fileName,
      declaredFileSize: input.fileSize,
      declaredDurationSeconds: input.durationSeconds,
      createdAtMs: input.createdAtMs,
      createTime: this.clock,
      expiresAt: new Date(input.taskExpiresAtMs).toISOString(),
      timeline: []
    }
    this.tasks.push(task)
    return { status: 'created', task: clone(task) }
  }

  async getTask(taskId) {
    const task = this.tasks.find(item => item._id === taskId)
    return task ? clone(task) : null
  }

  async markTaskProcessing(input) {
    const task = this.tasks.find(item => (
      item._id === input.taskId &&
      item._openid === input.openid &&
      item.status === 'awaiting_upload'
    ))
    if (!task) return false
    Object.assign(task, {
      status: 'processing',
      fileID: input.fileID,
      startedAtMs: input.startedAtMs
    })
    return true
  }

  async setProviderTask(taskId, providerTaskId, submittedAtMs) {
    const task = this.tasks.find(item => item._id === taskId && item.status === 'processing')
    if (!task) return false
    Object.assign(task, {
      providerTaskId: providerTaskId,
      providerSubmittedAtMs: submittedAtMs
    })
    return true
  }

  async completeTask(taskId, timeline, completedAtMs) {
    const task = this.tasks.find(item => item._id === taskId && item.status === 'processing')
    if (!task) return
    Object.assign(task, {
      status: 'done',
      timeline: clone(timeline),
      completedAtMs: completedAtMs,
      error: ''
    })
  }

  async failTask(taskId, error, failedAtMs) {
    const task = this.tasks.find(item => item._id === taskId && item.status === 'processing')
    if (!task) return
    Object.assign(task, {
      status: 'error',
      error: error,
      failedAtMs: failedAtMs
    })
  }

  snapshot() {
    return clone({ tasks: this.tasks, rateLimits: this.rateLimits })
  }
}

module.exports = { InMemoryAiTaskDatabase }
