const crypto = require('crypto')

const ORDER_RATE_LIMIT = 10
const ORDER_RATE_WINDOW_MS = 60 * 60 * 1000

function createOrderRateLimitId(openid, windowStartMs) {
  const digest = crypto
    .createHash('sha256')
    .update(`order-rate:${openid}:${windowStartMs}`, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `order_rate_${digest}`
}

module.exports = {
  ORDER_RATE_LIMIT,
  ORDER_RATE_WINDOW_MS,
  createOrderRateLimitId
}
