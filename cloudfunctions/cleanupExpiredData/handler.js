const DEFAULT_BATCH_SIZE = 20
const MAX_BATCH_SIZE = 50

function normalizedBatchSize(value) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE
  return Math.min(parsed, MAX_BATCH_SIZE)
}

function isCloudFileID(value) {
  return typeof value === 'string' && value.startsWith('cloud://') && value.length <= 500
}

function createCleanupExpiredDataHandler(dependencies) {
  const { isEnabled, now, database, deleteCloudFile, logger } = dependencies

  return async function cleanupExpiredData(event = {}) {
    const dryRun = event.dryRun === true
    if (!dryRun && !isEnabled()) {
      return { code: 0, data: { status: 'disabled' } }
    }
    if (!dryRun && event.Type !== 'Timer') {
      return { code: -3, error: '数据清理仅允许由定时触发器执行' }
    }

    const timestamp = now()
    const batchSize = normalizedBatchSize(event.batchSize)
    try {
      const candidates = await database.listExpiredAiTasks(timestamp, batchSize)
      if (dryRun) {
        return {
          code: 0,
          data: {
            status: 'dry-run',
            expiredAiTasks: candidates.length,
            batchSize: batchSize
          }
        }
      }

      const summary = {
        status: 'completed',
        claimedAiTasks: 0,
        deletedAiTasks: 0,
        manualReviewTasks: 0,
        failedAiTasks: 0,
        deletedRateLimits: 0
      }

      for (const candidate of candidates) {
        const task = await database.claimExpiredAiTask(candidate._id, timestamp)
        if (!task) continue
        summary.claimedAiTasks += 1

        if (!isCloudFileID(task.fileID)) {
          await database.markTaskForManualReview(task._id, timestamp, 'missing-file-id')
          summary.manualReviewTasks += 1
          continue
        }

        try {
          const deleted = await deleteCloudFile(task.fileID)
          if (!deleted) {
            const storageFailure = new Error('Cloud Storage did not confirm deletion')
            storageFailure.code = 'STORAGE_DELETE_UNCONFIRMED'
            throw storageFailure
          }
          const removed = await database.removeClaimedAiTask(task._id)
          if (!removed) {
            const databaseFailure = new Error('Claimed AI task could not be removed')
            databaseFailure.code = 'AI_TASK_REMOVE_UNCONFIRMED'
            throw databaseFailure
          }
          summary.deletedAiTasks += 1
        } catch (error) {
          logger.error('AI task cleanup failed', error && error.code ? error.code : 'UNKNOWN')
          await database.releaseCleanupClaim(task._id, timestamp)
          summary.failedAiTasks += 1
        }
      }

      summary.deletedRateLimits = await database.deleteExpiredRateLimits(timestamp, batchSize)
      return { code: 0, data: summary }
    } catch (error) {
      logger.error('cleanupExpiredData failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '数据清理执行失败' }
    }
  }
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  createCleanupExpiredDataHandler,
  isCloudFileID,
  normalizedBatchSize
}
