function documentData(result) {
  if (!result) return null
  if (Array.isArray(result.data)) return result.data[0] || null
  return result.data || null
}

function transactionValue(result) {
  if (result && result.result && typeof result.result.status === 'string') {
    return result.result
  }
  return result
}

function createCloudDatabaseAdapter(db) {
  return {
    async prepareTask(input) {
      const result = await db.runTransaction(async transaction => {
        const taskReference = transaction.collection('aiTasks').doc(input.taskId)
        const rateReference = transaction.collection('rateLimits').doc(input.rateLimitId)
        const taskResult = await taskReference.get()
        const existingTask = documentData(taskResult)

        if (existingTask) {
          if (
            existingTask._openid !== input.openid ||
            existingTask.requestId !== input.requestId
          ) {
            const collision = new Error('Deterministic AI task ID collision')
            collision.code = 'AI_TASK_ID_COLLISION'
            throw collision
          }
          return { status: 'duplicate', task: existingTask }
        }

        const rateResult = await rateReference.get()
        const rate = documentData(rateResult)
        const currentCount = rate && rate.windowStartMs === input.windowStartMs
          ? Number(rate.count || 0)
          : 0
        if (currentCount >= input.maximumRequests) {
          return { status: 'rate-limited' }
        }

        await rateReference.set({
          data: {
            _openid: input.openid,
            scope: 'analyzeVideo',
            windowStartMs: input.windowStartMs,
            count: currentCount + 1,
            expiresAt: new Date(input.rateLimitExpiresAtMs)
          }
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
          createTime: db.serverDate(),
          expiresAt: new Date(input.taskExpiresAtMs),
          timeline: []
        }
        await taskReference.set({ data: task })
        return { status: 'created', task: task }
      })
      return transactionValue(result)
    },

    async getTask(taskId) {
      const result = await db.collection('aiTasks').doc(taskId).get()
      return documentData(result)
    },

    async markTaskProcessing(input) {
      const result = await db.collection('aiTasks')
        .where({
          _id: input.taskId,
          _openid: input.openid,
          status: 'awaiting_upload'
        })
        .update({
          data: {
            status: 'processing',
            fileID: input.fileID,
            startedAtMs: input.startedAtMs,
            startedTime: db.serverDate()
          }
        })
      return Boolean(result.stats && result.stats.updated === 1)
    },

    async setProviderTask(taskId, providerTaskId, submittedAtMs) {
      const result = await db.collection('aiTasks')
        .where({ _id: taskId, status: 'processing' })
        .update({
          data: {
            providerTaskId: providerTaskId,
            providerSubmittedAtMs: submittedAtMs,
            providerSubmittedTime: db.serverDate()
          }
        })
      return Boolean(result.stats && result.stats.updated === 1)
    },

    async completeTask(taskId, timeline, completedAtMs) {
      await db.collection('aiTasks')
        .where({ _id: taskId, status: 'processing' })
        .update({
          data: {
            status: 'done',
            timeline: timeline,
            completedAtMs: completedAtMs,
            completedTime: db.serverDate(),
            error: ''
          }
        })
    },

    async failTask(taskId, error, failedAtMs) {
      await db.collection('aiTasks')
        .where({ _id: taskId, status: 'processing' })
        .update({
          data: {
            status: 'error',
            error: error,
            failedAtMs: failedAtMs,
            failedTime: db.serverDate()
          }
        })
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
