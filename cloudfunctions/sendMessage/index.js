const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createSendMessageHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database({ throwOnNotFound: false }))

exports.main = createSendMessageHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  now: () => Date.now(),
  database: database,
  logger: console
})
