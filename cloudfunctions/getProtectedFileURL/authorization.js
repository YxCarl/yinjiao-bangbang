function isCloudFileID(value) {
  return typeof value === 'string' && value.startsWith('cloud://') && value.length <= 1024
}

function isOrderParticipant(openid, order, mentorProfiles) {
  if (!openid || !order) return false
  if (order._openid === openid) return true
  if (!order.teacherId || !Array.isArray(mentorProfiles)) return false
  return mentorProfiles.some(profile => profile && profile._id === order.teacherId)
}

function hasConversationMembership(openid, memberships) {
  if (!openid || !Array.isArray(memberships)) return false
  return memberships.some(membership => membership && membership._openid === openid)
}

function storedVoiceMatches(fileID, messages) {
  if (!isCloudFileID(fileID) || !Array.isArray(messages)) return false
  return messages.some(message => (
    message && message.kind === 'voice' && message.fileID === fileID
  ))
}

module.exports = {
  hasConversationMembership,
  isCloudFileID,
  isOrderParticipant,
  storedVoiceMatches
}
