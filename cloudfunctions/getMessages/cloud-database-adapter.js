function createCloudDatabaseAdapter(db) {
  return {
    async getMembership(openid, conversationId) {
      const result = await db.collection('conversations')
        .where({ _openid: openid, conversationId: conversationId })
        .limit(1)
        .get()
      return result.data[0] || null
    },

    async getOrder(orderId) {
      try {
        const result = await db.collection('orders').doc(orderId).get()
        return result.data || null
      } catch (_) {
        return null
      }
    },

    async findApprovedMentor(openid) {
      const result = await db.collection('users')
        .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
        .limit(1)
        .get()
      return result.data[0] || null
    },

    async listMessages(conversationId) {
      const result = await db.collection('messages')
        .where({ conversationId: conversationId })
        .orderBy('createTime', 'asc')
        .get()
      return result.data
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
