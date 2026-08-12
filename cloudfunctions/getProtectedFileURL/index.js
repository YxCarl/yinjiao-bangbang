const cloud = require('wx-server-sdk')
const {
  hasConversationMembership,
  isCloudFileID,
  isOrderParticipant,
  storedVoiceMatches
} = require('./authorization')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getMentorProfiles(openid) {
  const result = await db.collection('users')
    .where({ _openid: openid, role: 'mentor' })
    .limit(5)
    .get()
  return result.data
}

async function canAccessLegacyOrder(openid, conversationId) {
  if (!conversationId.startsWith('order_')) return false
  const orderId = conversationId.slice('order_'.length)
  if (!orderId) return false

  try {
    const result = await db.collection('orders').doc(orderId).get()
    return isOrderParticipant(openid, result.data, await getMentorProfiles(openid))
  } catch (_) {
    return false
  }
}

async function resolveOrderFile(openid, orderId) {
  const result = await db.collection('orders').doc(orderId).get()
  const order = result.data
  if (!isOrderParticipant(openid, order, await getMentorProfiles(openid))) return ''
  return order && order.detail && isCloudFileID(order.detail.fileID) ? order.detail.fileID : ''
}

async function resolveMessageFile(openid, conversationId, fileID) {
  if (!isCloudFileID(fileID)) return ''

  const membershipResult = await db.collection('conversations')
    .where({ _openid: openid, conversationId: conversationId })
    .limit(1)
    .get()

  const isMember = hasConversationMembership(openid, membershipResult.data)
  if (!isMember && !(await canAccessLegacyOrder(openid, conversationId))) return ''

  const messageResult = await db.collection('messages')
    .where({ conversationId: conversationId, fileID: fileID, kind: 'voice' })
    .limit(1)
    .get()

  return storedVoiceMatches(fileID, messageResult.data) ? fileID : ''
}

async function resolveContentFile(contentId) {
  const result = await db.collection('contents').doc(contentId).get()
  const content = result.data
  return content && isCloudFileID(content.fileID) ? content.fileID : ''
}

async function resolveFileID(openid, kind, referenceId, suppliedFileID) {
  if (kind === 'order') return resolveOrderFile(openid, referenceId)
  if (kind === 'message') return resolveMessageFile(openid, referenceId, suppliedFileID)
  if (kind === 'content') return resolveContentFile(referenceId)
  return ''
}

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext()
  const kind = typeof event.kind === 'string' ? event.kind : ''
  const referenceId = typeof event.referenceId === 'string' ? event.referenceId.trim().slice(0, 128) : ''
  const suppliedFileID = typeof event.fileID === 'string' ? event.fileID : ''

  if (!openid) return { code: -2, error: '请先登录' }
  if (!referenceId || !['order', 'message', 'content'].includes(kind)) {
    return { code: -1, error: '文件参数无效' }
  }

  try {
    const fileID = await resolveFileID(openid, kind, referenceId, suppliedFileID)
    if (!fileID) return { code: -3, error: '无权访问此文件' }

    const result = await cloud.getTempFileURL({ fileList: [fileID] })
    const item = result.fileList && result.fileList[0]
    if (!item || !item.tempFileURL) return { code: -1, error: '文件链接生成失败' }

    return {
      code: 0,
      data: {
        url: item.tempFileURL
      }
    }
  } catch (error) {
    console.error('Protected file access failed', error && error.errCode ? error.errCode : 'UNKNOWN')
    return { code: -1, error: '文件访问失败' }
  }
}
