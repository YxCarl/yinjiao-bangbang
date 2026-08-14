const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createGetMessagesHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database())

exports.main = createGetMessagesHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  database: database,
  logger: console
})
