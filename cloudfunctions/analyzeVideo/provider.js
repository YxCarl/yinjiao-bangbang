const https = require('https')

const DEFAULT_TIMEOUT_MS = 15000
const MAX_RESPONSE_BYTES = 1024 * 1024

function createZhipuVideoProvider(options) {
  const apiKey = options.apiKey
  const model = options.model || 'glm-4v-plus'
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const parseTimeline = options.parseTimeline

  return {
    isConfigured() {
      return Boolean(apiKey)
    },

    async submit(videoUrl, requestId) {
      await assertRemoteVideoSize(videoUrl, options.maxVideoBytes, 8000)
      const response = await requestJson({
        apiKey: apiKey,
        timeoutMs: timeoutMs,
        method: 'POST',
        path: '/api/paas/v4/async/chat/completions',
        body: completionBody(model, videoUrl, requestId)
      })
      const providerTaskId = response && typeof response.id === 'string'
        ? response.id.trim()
        : ''
      if (!providerTaskId || providerTaskId.length > 200) {
        const invalid = new Error('Provider response contained no task ID')
        invalid.code = 'PROVIDER_TASK_ID_MISSING'
        throw invalid
      }
      return providerTaskId
    },

    async getResult(providerTaskId) {
      if (typeof providerTaskId !== 'string' || providerTaskId.length > 200) {
        const invalid = new Error('Stored provider task ID is invalid')
        invalid.code = 'PROVIDER_TASK_ID_INVALID'
        throw invalid
      }
      const response = await requestJson({
        apiKey: apiKey,
        timeoutMs: timeoutMs,
        method: 'GET',
        path: `/api/paas/v4/async-result/${encodeURIComponent(providerTaskId)}`
      })
      return interpretAsyncResult(response, parseTimeline)
    }
  }
}

function interpretAsyncResult(response, parseTimeline) {
  const status = response && typeof response.task_status === 'string'
    ? response.task_status.toUpperCase()
    : ''
  if (status === 'FAIL' || status === 'FAILED') return { status: 'error' }

  const content = response &&
    Array.isArray(response.choices) &&
    response.choices[0] &&
    response.choices[0].message
    ? response.choices[0].message.content
    : ''
  if (!content && status !== 'SUCCESS') return { status: 'processing' }

  const timeline = parseTimeline(content)
  if (timeline.length === 0) {
    const invalid = new Error('Provider response contained no timeline')
    invalid.code = 'PROVIDER_RESPONSE_INVALID'
    throw invalid
  }
  return { status: 'done', timeline: timeline }
}

function completionBody(model, videoUrl, requestId) {
  return {
    model: model,
    request_id: requestId,
    messages: [{
      role: 'user',
      content: [
        { type: 'video_url', video_url: { url: videoUrl } },
        {
          type: 'text',
          text: '请分析这个课堂教学视频，列出关键教学环节。以 JSON 数组返回，每项只包含 time、label、desc，按时间排序，不要返回其他内容。'
        }
      ]
    }],
    max_tokens: 1500,
    temperature: 0.2,
    stream: false
  }
}

function remoteSizeFromHeaders(statusCode, headers) {
  if (statusCode === 206 && typeof headers['content-range'] === 'string') {
    const match = headers['content-range'].match(/\/(\d+)$/)
    if (match) return Number(match[1])
  }
  const contentLength = Number(headers['content-length'])
  return Number.isSafeInteger(contentLength) ? contentLength : 0
}

function assertRemoteVideoSize(videoUrl, maximumBytes, timeoutMs, redirectsRemaining = 2) {
  return new Promise((resolve, reject) => {
    let target
    try {
      target = new URL(videoUrl)
    } catch (_) {
      const invalidUrl = new Error('Video URL is invalid')
      invalidUrl.code = 'VIDEO_URL_INVALID'
      reject(invalidUrl)
      return
    }
    if (target.protocol !== 'https:') {
      const insecureUrl = new Error('Video URL must use HTTPS')
      insecureUrl.code = 'VIDEO_URL_INSECURE'
      reject(insecureUrl)
      return
    }

    const request = https.request(target, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' }
    }, response => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location &&
        redirectsRemaining > 0
      ) {
        response.resume()
        const redirected = new URL(response.headers.location, target).toString()
        assertRemoteVideoSize(
          redirected,
          maximumBytes,
          timeoutMs,
          redirectsRemaining - 1
        ).then(resolve, reject)
        return
      }

      const size = remoteSizeFromHeaders(response.statusCode, response.headers)
      response.destroy()
      if ((response.statusCode !== 200 && response.statusCode !== 206) || size <= 0) {
        const unknownSize = new Error('Unable to verify remote video size')
        unknownSize.code = 'VIDEO_SIZE_UNKNOWN'
        reject(unknownSize)
        return
      }
      if (!Number.isSafeInteger(maximumBytes) || size >= maximumBytes) {
        const tooLarge = new Error('Remote video exceeds the configured size limit')
        tooLarge.code = 'VIDEO_TOO_LARGE'
        reject(tooLarge)
        return
      }
      resolve(size)
    })

    request.setTimeout(timeoutMs, () => {
      request.destroy(Object.assign(new Error('Video size check timed out'), {
        code: 'VIDEO_SIZE_CHECK_TIMEOUT'
      }))
    })
    request.on('error', reject)
    request.end()
  })
}

function requestJson(input) {
  const requestBody = input.body ? JSON.stringify(input.body) : ''

  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: 'https:',
      hostname: 'open.bigmodel.cn',
      path: input.path,
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        ...(requestBody ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        } : {})
      }
    }, response => {
      const chunks = []
      let responseBytes = 0
      response.on('data', chunk => {
        responseBytes += chunk.length
        if (responseBytes > MAX_RESPONSE_BYTES) {
          request.destroy(Object.assign(new Error('Provider response too large'), {
            code: 'PROVIDER_RESPONSE_TOO_LARGE'
          }))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const providerError = new Error('Provider returned a non-success status')
          providerError.code = 'PROVIDER_HTTP_ERROR'
          reject(providerError)
          return
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (_) {
          const parseError = new Error('Provider returned invalid JSON')
          parseError.code = 'PROVIDER_JSON_INVALID'
          reject(parseError)
        }
      })
    })

    request.setTimeout(input.timeoutMs, () => {
      request.destroy(Object.assign(new Error('Provider request timed out'), {
        code: 'PROVIDER_TIMEOUT'
      }))
    })
    request.on('error', reject)
    if (requestBody) request.write(requestBody)
    request.end()
  })
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  assertRemoteVideoSize,
  completionBody,
  interpretAsyncResult,
  remoteSizeFromHeaders,
  createZhipuVideoProvider
}
