const { createHash } = require('node:crypto')

function membershipId(openid, conversationId) {
  return 'conv_' + createHash('sha256')
    .update(JSON.stringify([openid, conversationId]))
    .digest('hex').slice(0, 32)
}

module.exports = { membershipId }
