function documentData(result) {
  if (!result) return null
  if (Array.isArray(result.data)) return result.data[0] || null
  return result.data || null
}

function transactionValue(result) {
  return result && result.result !== undefined ? result.result : result
}

function dateMilliseconds(value) {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(milliseconds) ? milliseconds : 0
}

function createCloudDatabaseAdapter(db) {
  const command = db.command
  return {
    async listExpiredAiTasks(nowMs, limit) {
      const result = await db.collection('aiTasks')
        .where({
          cleanupEligible: true,
          expiresAt: command.lte(new Date(nowMs))
        })
        .limit(limit)
        .get()
      return result.data || []
    },

    async claimExpiredAiTask(taskId, nowMs) {
      const result = await db.runTransaction(async transaction => {
        const reference = transaction.collection('aiTasks').doc(taskId)
        const task = documentData(await reference.get())
        if (
          !task ||
          task.cleanupEligible !== true ||
          task.orderId ||
          dateMilliseconds(task.expiresAt) > nowMs
        ) {
          return null
        }
        await reference.update({
          data: {
            cleanupEligible: false,
            cleanupState: 'deleting',
            cleanupClaimedAtMs: nowMs,
            cleanupClaimedTime: db.serverDate()
          }
        })
        return Object.assign({}, task, {
          cleanupEligible: false,
          cleanupState: 'deleting'
        })
      })
      return transactionValue(result)
    },

    async removeClaimedAiTask(taskId) {
      const result = await db.collection('aiTasks')
        .where({ _id: taskId, cleanupState: 'deleting', cleanupEligible: false })
        .remove()
      return Boolean(result.stats && result.stats.removed === 1)
    },

    async releaseCleanupClaim(taskId, nowMs) {
      await db.collection('aiTasks')
        .where({ _id: taskId, cleanupState: 'deleting', cleanupEligible: false })
        .update({
          data: {
            cleanupEligible: true,
            cleanupState: 'retry',
            cleanupLastFailedAtMs: nowMs,
            cleanupLastFailedTime: db.serverDate()
          }
        })
    },

    async markTaskForManualReview(taskId, nowMs, reason) {
      await db.collection('aiTasks')
        .where({ _id: taskId, cleanupState: 'deleting', cleanupEligible: false })
        .update({
          data: {
            cleanupState: 'manual-review',
            cleanupReason: reason,
            cleanupReviewedAtMs: nowMs,
            cleanupReviewedTime: db.serverDate()
          }
        })
    },

    async deleteExpiredRateLimits(nowMs, limit) {
      const result = await db.collection('rateLimits')
        .where({ expiresAt: command.lte(new Date(nowMs)) })
        .limit(limit)
        .get()
      let removed = 0
      for (const record of result.data || []) {
        const deletion = await db.collection('rateLimits').doc(record._id).remove()
        removed += deletion.stats && deletion.stats.removed === 1 ? 1 : 0
      }
      return removed
    }
  }
}

module.exports = { createCloudDatabaseAdapter, dateMilliseconds }
