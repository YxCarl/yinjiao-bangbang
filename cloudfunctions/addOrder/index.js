const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { getVerifiedRemoteSize } = require('./document-upload')
const { createAddOrderHandler } = require('./handler')
const { createOrderDocumentId } = require('./order-id')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database({ throwOnNotFound: false }))

async function getCloudFileSize(fileID) {
  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  const file = result && Array.isArray(result.fileList) ? result.fileList[0] : null
  if (!file || file.status !== 0 || typeof file.tempFileURL !== 'string') {
    const unavailable = new Error('Unable to obtain document URL')
    unavailable.code = 'DOCUMENT_TEMP_URL_UNAVAILABLE'
    throw unavailable
  }
  return getVerifiedRemoteSize(file.tempFileURL)
}

exports.main = createAddOrderHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  createOrderId: createOrderDocumentId,
  getCloudFileSize: getCloudFileSize,
  now: () => Date.now(),
  database: database,
  logger: console
})
