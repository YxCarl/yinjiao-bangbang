const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createGetOrdersHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database())

exports.main = createGetOrdersHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  database: database,
  logger: console
})
