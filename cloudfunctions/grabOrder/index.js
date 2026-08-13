const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createGrabOrderHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database())

exports.main = createGrabOrderHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  database: database,
  logger: console
})
