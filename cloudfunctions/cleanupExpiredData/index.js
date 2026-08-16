const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createCleanupExpiredDataHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database({ throwOnNotFound: false }))

async function deleteCloudFile(fileID) {
  const result = await cloud.deleteFile({ fileList: [fileID] })
  const file = result && Array.isArray(result.fileList) ? result.fileList[0] : null
  if (!file) return false
  if (file.status === 0 || file.code === 'SUCCESS') return true
  const detail = `${file.code || ''} ${file.errMsg || file.message || ''}`
  return /not[ -]?exist|not[ -]?found|不存在/i.test(detail)
}

exports.main = createCleanupExpiredDataHandler({
  isEnabled: () => process.env.DATA_CLEANUP_ENABLED === 'true',
  now: () => Date.now(),
  database: database,
  deleteCloudFile: deleteCloudFile,
  logger: console
})
