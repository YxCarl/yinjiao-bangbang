const cloud = require('wx-server-sdk')
const { createGetContentsHandler } = require('./handler')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = createGetContentsHandler({
  database: createCloudDatabaseAdapter(cloud.database()),
  logger: console
})
