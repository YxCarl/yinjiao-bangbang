let sequence = 0

function createRequestId(prefix) {
  sequence = (sequence + 1) % 1679616
  const timestamp = Date.now().toString(36)
  const counter = sequence.toString(36).padStart(4, '0')
  const random = Math.random().toString(36).slice(2, 10).padEnd(8, '0')
  const safePrefix = /^[a-z][a-z0-9_-]{1,15}$/.test(prefix) ? prefix : 'request'
  return `${safePrefix}_${timestamp}_${counter}_${random}`
}

function createOrderRequestId() {
  return createRequestId('order')
}

function beginOrderRequest(page, payload) {
  if (page._orderSubmissionInFlight) return ''

  const fingerprint = JSON.stringify(payload)
  page._orderSubmissionInFlight = true
  if (
    !page._pendingOrderRequest ||
    page._pendingOrderRequest.fingerprint !== fingerprint
  ) {
    page._pendingOrderRequest = {
      fingerprint: fingerprint,
      requestId: createOrderRequestId()
    }
  }
  return page._pendingOrderRequest.requestId
}

function finishOrderRequest(page, confirmed) {
  page._orderSubmissionInFlight = false
  if (confirmed) delete page._pendingOrderRequest
}

module.exports = {
  beginOrderRequest,
  createRequestId,
  createOrderRequestId,
  finishOrderRequest
}
