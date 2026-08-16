function createCloudDatabaseAdapter(db) {
  return {
    async listConversations(openid) {
      const result = await db.collection('conversations')
        .where({ _openid: openid })
        .orderBy('lastTime', 'desc')
        .get()
      return result.data
    },

    async findApprovedMentors(openid) {
      const result = await db.collection('users')
        .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
        .limit(5)
        .get()
      return result.data
    },

    async getOrder(orderId) {
      try {
        const result = await db.collection('orders').doc(orderId).get()
        return result.data || null
      } catch (_) {
        return null
      }
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
