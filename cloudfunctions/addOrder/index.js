const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createAddOrderHandler } = require('./handler')
const { createOrderDocumentId } = require('./order-id')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database({ throwOnNotFound: false }))

exports.main = createAddOrderHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  createOrderId: createOrderDocumentId,
  now: () => Date.now(),
  database: database,
  logger: console
})
