const crypto = require('crypto')
const https = require('https')

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024
const MAX_RESPONSE_REDIRECTS = 2
const SIZE_CHECK_TIMEOUT_MS = 5000

function normalizeDocumentMetadata(fileName, fileSize) {
  const normalizedName = typeof fileName === 'string' ? fileName.trim() : ''
  if (!normalizedName || normalizedName.length > 200 || /[\\/]/.test(normalizedName)) {
    return { ok: false, error: '教案文件名无效' }
  }

  const extensionMatch = normalizedName.match(/\.([A-Za-z0-9]+)$/)
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : ''
  if (!['doc', 'docx', 'pdf'].includes(extension)) {
    return { ok: false, error: '仅支持 DOC、DOCX 或 PDF 教案文件' }
  }

  const bytes = Number(fileSize)
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: '教案文件大小必须在 50MB 以内' }
  }

  return {
    ok: true,
    value: { fileName: normalizedName, fileSize: bytes, extension: extension }
  }
}

function documentUploadPath(openid, requestId, extension) {
  const digest = crypto
    .createHash('sha256')
    .update(`document:${openid}:${requestId}`, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `moke/doc_${digest}.${extension}`
}

function cloudFileMatchesDocumentPath(fileID, expectedPath) {
  if (typeof fileID !== 'string' || fileID.length > 500 || !fileID.startsWith('cloud://')) {
    return false
  }

  const pathSeparator = fileID.indexOf('/', 'cloud://'.length)
  return pathSeparator > 'cloud://'.length && fileID.slice(pathSeparator + 1) === expectedPath
}

function remoteSizeFromHeaders(statusCode, headers = {}) {
  if (statusCode === 206 && typeof headers['content-range'] === 'string') {
    const match = headers['content-range'].match(/\/(\d+)$/)
    if (match) {
      const total = Number(match[1])
      return Number.isSafeInteger(total) ? total : 0
    }
  }

  const contentLength = Number(headers['content-length'])
  return Number.isSafeInteger(contentLength) ? contentLength : 0
}

function getVerifiedRemoteSize(fileUrl, redirectsRemaining = MAX_RESPONSE_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let target
    try {
      target = new URL(fileUrl)
    } catch (_) {
      const invalid = new Error('Document URL is invalid')
      invalid.code = 'DOCUMENT_URL_INVALID'
      reject(invalid)
      return
    }

    if (target.protocol !== 'https:') {
      const insecure = new Error('Document URL must use HTTPS')
      insecure.code = 'DOCUMENT_URL_INSECURE'
      reject(insecure)
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
        let redirected
        try {
          redirected = new URL(response.headers.location, target).toString()
        } catch (_) {
          const invalidRedirect = new Error('Document redirect URL is invalid')
          invalidRedirect.code = 'DOCUMENT_REDIRECT_INVALID'
          reject(invalidRedirect)
          return
        }
        getVerifiedRemoteSize(redirected, redirectsRemaining - 1).then(resolve, reject)
        return
      }

      const size = remoteSizeFromHeaders(response.statusCode, response.headers)
      response.destroy()
      if ((response.statusCode !== 200 && response.statusCode !== 206) || size <= 0) {
        const unknown = new Error('Unable to verify document size')
        unknown.code = 'DOCUMENT_SIZE_UNKNOWN'
        reject(unknown)
        return
      }
      resolve(size)
    })

    request.setTimeout(SIZE_CHECK_TIMEOUT_MS, () => {
      request.destroy(Object.assign(new Error('Document size check timed out'), {
        code: 'DOCUMENT_SIZE_CHECK_TIMEOUT'
      }))
    })
    request.on('error', reject)
    request.end()
  })
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  cloudFileMatchesDocumentPath,
  documentUploadPath,
  getVerifiedRemoteSize,
  normalizeDocumentMetadata,
  remoteSizeFromHeaders
}
