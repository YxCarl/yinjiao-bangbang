const crypto = require('crypto')

const MAX_VIDEO_BYTES = 200 * 1024 * 1024
const MAX_VIDEO_DURATION_SECONDS = 600
const MAX_TIMELINE_ITEMS = 100
const REQUESTS_PER_HOUR = 3
const RATE_WINDOW_MS = 60 * 60 * 1000
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000
const TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function boundedText(value, maximumLength) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : ''
}

function digest(parts) {
  return crypto
    .createHash('sha256')
    .update(parts.join(':'), 'utf8')
    .digest('hex')
    .slice(0, 32)
}

function createTaskId(openid, requestId) {
  return `ai_${digest(['task', openid, requestId])}`
}

function createRateLimitId(openid, windowStartMs) {
  return `ai_rate_${digest(['rate', openid, String(windowStartMs)])}`
}

function uploadPathForTask(taskId) {
  return `zhenke/${taskId}.mp4`
}

function isValidTaskId(value) {
  return /^ai_[a-f0-9]{32}$/.test(value)
}

function cloudFileMatchesPath(fileID, expectedPath) {
  if (typeof fileID !== 'string' || !fileID.startsWith('cloud://')) return false
  return fileID.endsWith(`/${expectedPath}`)
}

function validatePrepareRequest(event) {
  const requestId = boundedText(event.requestId, 80)
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
    return { ok: false, error: '请求标识无效，请更新小程序后重试' }
  }

  const fileName = boundedText(event.fileName, 200)
  if (!fileName || !/\.(?:mp4|mov|m4v)$/i.test(fileName)) {
    return { ok: false, error: '仅支持 MP4、MOV 或 M4V 视频' }
  }

  const fileSize = Number(event.fileSize)
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize >= MAX_VIDEO_BYTES) {
    return { ok: false, error: '视频大小必须小于 200MB' }
  }

  const durationSeconds = Number(event.durationSeconds)
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_VIDEO_DURATION_SECONDS
  ) {
    return { ok: false, error: '视频时长必须在 10 分钟以内' }
  }

  return {
    ok: true,
    value: {
      requestId: requestId,
      fileName: fileName,
      fileSize: fileSize,
      durationSeconds: Math.round(durationSeconds * 10) / 10
    }
  }
}

function normalizeTimelineItems(items) {
  if (!Array.isArray(items)) return []
  return items.slice(0, MAX_TIMELINE_ITEMS).map(item => ({
    time: boundedText(item && item.time, 20) || '00:00',
    label: boundedText(item && item.label, 100) || '教学环节',
    desc: boundedText(item && (item.desc || item.description), 500)
  }))
}

function parseTimeline(content) {
  if (typeof content !== 'string' || !content.trim()) return []
  const text = content.trim()
  const candidates = [text]
  const markdown = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (markdown) candidates.push(markdown[1].trim())
  const embedded = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (embedded) candidates.push(embedded[0])

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      const normalized = normalizeTimelineItems(parsed)
      if (normalized.length > 0) return normalized
    } catch (_) {}
  }

  const lines = text.split('\n').filter(line => line.trim())
  const timeline = []
  for (const line of lines.slice(0, MAX_TIMELINE_ITEMS)) {
    const timeMatch = line.match(/(\d{1,2}:\d{2})/)
    if (!timeMatch) continue
    const rest = line
      .replace(timeMatch[0], '')
      .replace(/^[\s\-:：]+/, '')
      .trim()
    const parts = rest.split(/\s+/)
    timeline.push({
      time: boundedText(timeMatch[1], 20),
      label: boundedText(parts[0], 100) || '教学环节',
      desc: boundedText(parts.slice(1).join(' ') || rest, 500)
    })
  }
  return timeline
}

function publicTask(task) {
  return {
    taskId: task._id,
    status: task.status,
    timeline: normalizeTimelineItems(task.timeline),
    error: task.status === 'error' ? boundedText(task.error, 100) : '',
    cloudPath: task.status === 'awaiting_upload' ? task.expectedCloudPath : ''
  }
}

module.exports = {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  PROCESSING_TIMEOUT_MS,
  RATE_WINDOW_MS,
  REQUESTS_PER_HOUR,
  TASK_RETENTION_MS,
  cloudFileMatchesPath,
  createRateLimitId,
  createTaskId,
  isValidTaskId,
  normalizeTimelineItems,
  parseTimeline,
  publicTask,
  uploadPathForTask,
  validatePrepareRequest
}
