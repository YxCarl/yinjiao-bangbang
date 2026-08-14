const cloud = require('wx-server-sdk')
const { createCloudDatabaseAdapter } = require('./cloud-database-adapter')
const { createAnalyzeVideoHandler } = require('./handler')
const { MAX_VIDEO_BYTES, parseTimeline } = require('./policy')
const { createZhipuVideoProvider } = require('./provider')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const database = createCloudDatabaseAdapter(cloud.database({ throwOnNotFound: false }))
const provider = createZhipuVideoProvider({
  apiKey: process.env.ZHIPU_API_KEY || '',
  model: process.env.ZHIPU_VIDEO_MODEL || 'glm-4v-plus',
  maxVideoBytes: MAX_VIDEO_BYTES,
  parseTimeline: parseTimeline
})

exports.main = createAnalyzeVideoHandler({
  getOpenid: () => cloud.getWXContext().OPENID,
  now: () => Date.now(),
  database: database,
  provider: provider,
  getTempFileUrl: async fileID => {
    const result = await cloud.getTempFileURL({ fileList: [fileID] })
    const file = result.fileList && result.fileList[0]
    return file && file.status === 0 ? file.tempFileURL || '' : ''
  },
  logger: console
})
