const crypto = require('crypto')

function createOrderDocumentId(openid, requestId) {
  const digest = crypto
    .createHash('sha256')
    .update(`${openid}:${requestId}`, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `order_${digest}`
}

module.exports = { createOrderDocumentId }
