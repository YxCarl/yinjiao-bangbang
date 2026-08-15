const {
  ORDER_RATE_LIMIT,
  ORDER_RATE_WINDOW_MS,
  createOrderRateLimitId
} = require('./rate-limit')

function boundedText(value, maximumLength) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : ''
}

function normalizePrice(value) {
  const price = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(price) || price <= 0 || price > 10000) return null

  const cents = Math.round(price * 100)
  if (Math.abs(price * 100 - cents) > 1e-8) return null
  return cents / 100
}

function normalizeTimeline(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).map(item => ({
    time: boundedText(item && item.time, 20),
    label: boundedText(item && item.label, 100),
    desc: boundedText(item && item.desc, 500)
  }))
}

function normalizeDetail(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const detail = {}
  const textFields = {
    content: 500,
    grade: 30,
    subject: 30,
    level: 50,
    fileName: 200,
    fileID: 500,
    videoName: 200
  }
  for (const [field, limit] of Object.entries(textFields)) {
    const normalized = boundedText(value[field], limit)
    if (normalized) detail[field] = normalized
  }
  const timeline = normalizeTimeline(value.aiTimeline)
  if (timeline.length > 0) detail.aiTimeline = timeline
  return detail
}

function describeOrder(detail) {
  if (detail.content) return detail.content
  if (detail.subject) {
    return `${detail.grade || ''}${detail.subject} · ${detail.level || ''}`.slice(0, 500)
  }
  if (detail.videoName) return `视频诊断 · ${detail.videoName}`.slice(0, 500)
  return ''
}

function createAddOrderHandler(dependencies) {
  const { getOpenid, createOrderId, now, database, logger } = dependencies

  return async function addOrder(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const requestId = boundedText(event.requestId, 80)
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
      return { code: -1, error: '请求标识无效，请更新小程序后重试' }
    }

    const price = normalizePrice(event.price)
    if (price === null) return { code: -1, error: '金额无效' }

    const typeText = boundedText(event.typeText, 20)
    const title = boundedText(event.title, 100)
    if (!typeText || !title) return { code: -1, error: '订单类型和标题不能为空' }

    const detail = normalizeDetail(event.detail)
    const orderId = createOrderId(openid, requestId)
    const timestamp = now()
    const windowStartMs = Math.floor(timestamp / ORDER_RATE_WINDOW_MS) * ORDER_RATE_WINDOW_MS

    try {
      const student = await database.findStudentProfile(openid)
      if (!student) return { code: -1, error: '用户不存在' }

      const result = await database.createOrderAtomically({
        openid: openid,
        userId: student._id,
        orderId: orderId,
        rateLimitId: createOrderRateLimitId(openid, windowStartMs),
        requestId: requestId,
        price: price,
        createdAtMs: timestamp,
        windowStartMs: windowStartMs,
        maximumOrders: ORDER_RATE_LIMIT,
        rateLimitExpiresAtMs: windowStartMs + (2 * ORDER_RATE_WINDOW_MS),
        order: {
          typeText: typeText,
          title: title,
          student: student.name || '学员',
          studentAvatar: student.avatar || (student.name ? student.name[0] : '学'),
          desc: describeOrder(detail),
          detail: detail
        }
      })

      if (result.status === 'user-not-found') {
        return { code: -1, error: '用户不存在' }
      }
      if (result.status === 'insufficient-balance') {
        return {
          code: -2,
          error: `余额不足，当前余额 ¥${result.balance.toFixed(2)}`
        }
      }
      if (result.status === 'rate-limited') {
        return { code: -4, error: '订单创建过于频繁，请稍后再试' }
      }
      if (result.status !== 'created' && result.status !== 'duplicate') {
        const unexpected = new Error('Unexpected atomic order result')
        unexpected.code = 'UNEXPECTED_ORDER_RESULT'
        throw unexpected
      }

      return {
        code: 0,
        data: {
          _id: orderId,
          balance: result.balance,
          replayed: result.status === 'duplicate'
        }
      }
    } catch (error) {
      logger.error('addOrder failed', error && error.code ? error.code : 'UNKNOWN')
      return { code: -1, error: '创建订单失败' }
    }
  }
}

module.exports = {
  createAddOrderHandler,
  normalizeDetail,
  normalizePrice
}
