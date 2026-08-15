const crypto = require('crypto')

const MESSAGE_RATE_LIMIT = 30
const MESSAGE_RATE_WINDOW_MS = 60 * 1000

function digest(parts) {
  return crypto
    .createHash('sha256')
    .update(parts.join(':'), 'utf8')
    .digest('hex')
    .slice(0, 32)
}

function createMessageId(openid, requestId) {
  return `msg_${digest(['message', openid, requestId])}`
}

function createMessageRateLimitId(openid, windowStartMs) {
  return `msg_rate_${digest(['rate', openid, String(windowStartMs)])}`
}

function validateRequestId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(value.trim())
    ? value.trim()
    : ''
}

function normalizeConversationId(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return /^[A-Za-z0-9_-]{1,120}$/.test(normalized) ? normalized : ''
}

function normalizeMessage(event) {
  const requestId = validateRequestId(event.requestId)
  if (!requestId) return { ok: false, error: '消息请求标识无效，请更新小程序后重试' }

  if (event.kind !== 'text' && event.kind !== 'voice') {
    return { ok: false, error: '消息类型无效' }
  }

  if (event.kind === 'text') {
    const content = typeof event.content === 'string'
      ? event.content.trim().slice(0, 2000)
      : ''
    if (!content) return { ok: false, error: '消息内容不能为空' }
    return {
      ok: true,
      value: { requestId, kind: 'text', content, fileID: '', dur: 0, preview: content }
    }
  }

  const fileID = typeof event.fileID === 'string' ? event.fileID.trim() : ''
  const duration = Math.round(Number(event.dur))
  if (
    fileID.length > 500 ||
    !/^cloud:\/\/[^/]+\/chat\/[A-Za-z0-9_.-]+\.mp3$/i.test(fileID)
  ) {
    return { ok: false, error: '语音文件参数无效' }
  }
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > 60) {
    return { ok: false, error: '语音时长必须在 1 到 60 秒之间' }
  }
  return {
    ok: true,
    value: {
      requestId,
      kind: 'voice',
      content: `语音 ${duration} 秒`,
      fileID,
      dur: duration,
      preview: '[语音]'
    }
  }
}

module.exports = {
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW_MS,
  createMessageId,
  createMessageRateLimitId,
  normalizeConversationId,
  normalizeMessage
}
