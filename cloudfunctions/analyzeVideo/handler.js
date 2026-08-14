const {
  PROCESSING_TIMEOUT_MS,
  RATE_WINDOW_MS,
  REQUESTS_PER_HOUR,
  TASK_RETENTION_MS,
  cloudFileMatchesPath,
  createRateLimitId,
  createTaskId,
  isValidTaskId,
  normalizeTimelineItems,
  publicTask,
  uploadPathForTask,
  validatePrepareRequest
} = require('./policy')

function createAnalyzeVideoHandler(dependencies) {
  const { getOpenid, now, database, provider, getTempFileUrl, logger } = dependencies

  return async function analyzeVideo(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const action = event.action || (event.taskId ? 'status' : '')
    try {
      if (action === 'prepare') return prepareTask(event, openid)
      if (action === 'start') return startTask(event, openid)
      if (action === 'status') return readTask(event, openid)
      return { code: -1, error: '操作参数无效，请更新小程序后重试' }
    } catch (error) {
      logger.error('analyzeVideo failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '视频分析请求失败' }
    }
  }

  async function prepareTask(event, openid) {
    if (!provider.isConfigured()) return { code: -2, error: 'AI 服务未配置' }

    const validation = validatePrepareRequest(event)
    if (!validation.ok) return { code: -1, error: validation.error }

    const timestamp = now()
    const taskId = createTaskId(openid, validation.value.requestId)
    const windowStartMs = Math.floor(timestamp / RATE_WINDOW_MS) * RATE_WINDOW_MS
    const result = await database.prepareTask({
      openid: openid,
      taskId: taskId,
      rateLimitId: createRateLimitId(openid, windowStartMs),
      requestId: validation.value.requestId,
      expectedCloudPath: uploadPathForTask(taskId),
      fileName: validation.value.fileName,
      fileSize: validation.value.fileSize,
      durationSeconds: validation.value.durationSeconds,
      createdAtMs: timestamp,
      windowStartMs: windowStartMs,
      maximumRequests: REQUESTS_PER_HOUR,
      rateLimitExpiresAtMs: windowStartMs + (2 * RATE_WINDOW_MS),
      taskExpiresAtMs: timestamp + TASK_RETENTION_MS
    })

    if (result.status === 'rate-limited') {
      return { code: -4, error: '视频分析请求过于频繁，请稍后再试' }
    }
    if (result.status !== 'created' && result.status !== 'duplicate') {
      const unexpected = new Error('Unexpected AI preparation result')
      unexpected.code = 'UNEXPECTED_AI_PREPARE_RESULT'
      throw unexpected
    }
    return { code: 0, data: publicTask(result.task) }
  }

  async function readTask(event, openid) {
    const taskId = typeof event.taskId === 'string' ? event.taskId.trim() : ''
    if (!isValidTaskId(taskId)) return { code: -1, error: '任务参数无效' }

    let task = await database.getTask(taskId)
    if (!task || task._openid !== openid) return { code: -3, error: '无权访问此任务' }

    if (task.status === 'processing' && isProcessingExpired(task)) {
      await database.failTask(taskId, 'AI 分析超时', now())
      task = await database.getTask(taskId)
    } else if (task.status === 'processing' && task.providerTaskId) {
      task = await refreshProviderResult(task)
    }
    return { code: 0, data: publicTask(task) }
  }

  async function refreshProviderResult(task) {
    try {
      const result = await provider.getResult(task.providerTaskId)
      if (result.status === 'done') {
        const timeline = normalizeTimelineItems(result.timeline)
        if (timeline.length === 0) {
          const invalidTimeline = new Error('Provider returned an empty timeline')
          invalidTimeline.code = 'PROVIDER_TIMELINE_EMPTY'
          throw invalidTimeline
        }
        await database.completeTask(task._id, timeline, now())
      } else if (result.status === 'error') {
        await database.failTask(task._id, 'AI 分析失败', now())
      }
    } catch (error) {
      logger.error('video provider status failed', error && error.code ? error.code : 'UNKNOWN')
      if (
        error &&
        (error.code === 'PROVIDER_RESPONSE_INVALID' ||
          error.code === 'PROVIDER_TIMELINE_EMPTY')
      ) {
        await database.failTask(task._id, 'AI 分析结果无效', now())
      }
      // Network/query failures remain transient; the bounded processing timeout
      // eventually closes the task without discarding a successful provider job.
    }
    return database.getTask(task._id)
  }

  async function startTask(event, openid) {
    if (!provider.isConfigured()) return { code: -2, error: 'AI 服务未配置' }

    const taskId = typeof event.taskId === 'string' ? event.taskId.trim() : ''
    const fileID = typeof event.fileID === 'string' ? event.fileID.trim() : ''
    if (!isValidTaskId(taskId)) return { code: -1, error: '任务参数无效' }

    let task = await database.getTask(taskId)
    if (!task || task._openid !== openid) return { code: -3, error: '无权访问此任务' }
    if (task.status !== 'awaiting_upload') {
      return { code: 0, data: publicTask(task) }
    }
    if (!cloudFileMatchesPath(fileID, task.expectedCloudPath)) {
      return { code: -3, error: '视频文件与上传任务不匹配' }
    }

    const startedAtMs = now()
    const started = await database.markTaskProcessing({
      taskId: taskId,
      openid: openid,
      fileID: fileID,
      startedAtMs: startedAtMs
    })
    if (!started) {
      task = await database.getTask(taskId)
      return { code: 0, data: publicTask(task) }
    }

    try {
      const videoUrl = await getTempFileUrl(fileID)
      if (!videoUrl) {
        const missingUrl = new Error('Cloud Storage returned no temporary URL')
        missingUrl.code = 'VIDEO_URL_EMPTY'
        throw missingUrl
      }
      const providerTaskId = await provider.submit(videoUrl, taskId)
      const saved = await database.setProviderTask(taskId, providerTaskId, now())
      if (!saved) {
        const notSaved = new Error('Provider task ID could not be persisted')
        notSaved.code = 'PROVIDER_TASK_NOT_SAVED'
        throw notSaved
      }
      task = await database.getTask(taskId)
      return { code: 0, data: publicTask(task) }
    } catch (error) {
      logger.error('video provider submission failed', error && error.code ? error.code : 'UNKNOWN')
      await database.failTask(taskId, 'AI 分析启动失败', now())
      return { code: -1, error: 'AI 分析启动失败' }
    }
  }

  function isProcessingExpired(task) {
    return Number.isFinite(task.startedAtMs) &&
      now() - task.startedAtMs > PROCESSING_TIMEOUT_MS
  }
}

module.exports = { createAnalyzeVideoHandler }
