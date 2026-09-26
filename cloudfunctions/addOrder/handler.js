const {
  ORDER_RATE_LIMIT,
  ORDER_RATE_WINDOW_MS,
  createOrderRateLimitId
} = require('./rate-limit')
const {
  cloudFileMatchesDocumentPath,
  documentUploadPath,
  normalizeDocumentMetadata
} = require('./document-upload')

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
    videoName: 200,
    analysisTaskId: 100
  }
  for (const [field, limit] of Object.entries(textFields)) {
    const normalized = boundedText(value[field], limit)
    if (normalized) detail[field] = normalized
  }
  const fileSize = Number(value.fileSize)
  if (Number.isSafeInteger(fileSize) && fileSize > 0) detail.fileSize = fileSize
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
  const { getOpenid, createOrderId, getCloudFileSize, now, database, logger } = dependencies

  return async function addOrder(event = {}) {
    const openid = await getOpenid()
    if (!openid) return { code: -2, error: '请先登录' }

    const requestId = boundedText(event.requestId, 80)
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
      return { code: -1, error: '请求标识无效，请更新小程序后重试' }
    }

    if (event.action === 'prepare_document') {
      const metadata = normalizeDocumentMetadata(event.fileName, event.fileSize)
      if (!metadata.ok) return { code: -1, error: metadata.error }
      return {
        code: 0,
        data: {
          cloudPath: documentUploadPath(openid, requestId, metadata.value.extension)
        }
      }
    }

    const price = normalizePrice(event.price)
    if (price === null) return { code: -1, error: '金额无效' }

    const typeText = boundedText(event.typeText, 20)
    const title = typeText === '问诊室' ? '教育职场咨询' : boundedText(event.title, 100)
    if (!typeText || !title) return { code: -1, error: '订单类型和标题不能为空' }
    const anonymous = typeText === '问诊室' && event.anonymous === true

    const detail = normalizeDetail(event.detail)
    const orderId = createOrderId(openid, requestId)
    const timestamp = now()
    const windowStartMs = Math.floor(timestamp / ORDER_RATE_WINDOW_MS) * ORDER_RATE_WINDOW_MS

    try {
      const student = await database.findStudentProfile(openid)
      if (!student) return { code: -1, error: '用户不存在' }

      if (typeText === '磨课坊') {
        const metadata = normalizeDocumentMetadata(detail.fileName, detail.fileSize)
        if (!metadata.ok) return { code: -1, error: metadata.error }

        const expectedPath = documentUploadPath(openid, requestId, metadata.value.extension)
        if (!cloudFileMatchesDocumentPath(detail.fileID, expectedPath)) {
          return { code: -1, error: '教案文件与当前请求不匹配，请重新上传' }
        }

        detail.fileName = metadata.value.fileName
        detail.fileSize = metadata.value.fileSize
        const existingOrder = await database.getOrder(orderId)
        const isReplay = existingOrder &&
          existingOrder._openid === openid &&
          existingOrder.requestId === requestId

        if (!isReplay) {
          if (typeof getCloudFileSize !== 'function') {
            const unavailable = new Error('Document size verifier is unavailable')
            unavailable.code = 'DOCUMENT_SIZE_VERIFIER_UNAVAILABLE'
            throw unavailable
          }
          const actualFileSize = await getCloudFileSize(detail.fileID)
          if (
            !Number.isSafeInteger(actualFileSize) ||
            actualFileSize !== metadata.value.fileSize
          ) {
            return { code: -1, error: '教案文件大小校验失败，请重新上传' }
          }
        }
      }

      if (typeText === '诊课室') {
        const existingOrder = await database.getOrder(orderId)
        const isReplay = existingOrder &&
          existingOrder._openid === openid &&
          existingOrder.requestId === requestId

        if (!isReplay) {
          if (!/^ai_[a-f0-9]{32}$/.test(detail.analysisTaskId || '')) {
            return { code: -1, error: '视频分析任务无效，请重新分析' }
          }
          const analysisTask = await database.getAiTask(detail.analysisTaskId)
          if (
            !analysisTask ||
            analysisTask._openid !== openid ||
            analysisTask.status !== 'done' ||
            analysisTask.fileID !== detail.fileID
          ) {
            return { code: -1, error: '视频分析任务与当前用户或文件不匹配' }
          }

          const trustedTimeline = normalizeTimeline(analysisTask.timeline)
          if (trustedTimeline.length === 0) {
            return { code: -1, error: '视频分析结果不完整，请重新分析' }
          }
          detail.videoName = boundedText(analysisTask.originalFileName, 200) || detail.videoName
          detail.aiTimeline = trustedTimeline
        }
      }

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
        analysisTaskId: typeText === '诊课室' ? detail.analysisTaskId : '',
        analysisFileID: typeText === '诊课室' ? detail.fileID : '',
        order: {
          typeText: typeText,
          title: title,
          anonymous: anonymous,
          student: anonymous ? '匿名学员' : (student.name || '学员'),
          studentAvatar: anonymous ? '匿' : (student.avatar || (student.name ? student.name[0] : '学')),
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
      if (result.status === 'analysis-invalid') {
        return { code: -1, error: '视频分析任务已失效或无权使用' }
      }
      if (result.status === 'analysis-used') {
        return { code: -1, error: '该视频分析任务已创建过订单' }
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
