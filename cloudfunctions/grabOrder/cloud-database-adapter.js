function createCloudDatabaseAdapter(db) {
  return {
    async findApprovedMentor(openid) {
      const result = await db.collection('users')
        .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
        .limit(1)
        .get()
      return result.data[0] || null
    },

    async getOrder(orderId) {
      const result = await db.collection('orders').doc(orderId).get()
      return result.data || null
    },

    async claimOpenOrder(orderId, mentor) {
      const result = await db.collection('orders')
        .where({ _id: orderId, status: 0 })
        .update({
          data: {
            status: 1,
            teacher: mentor.name || '导师',
            teacherId: mentor._id,
            teacherAvatar: mentor.avatar || '师',
            claimTime: db.serverDate()
          }
        })
      return Boolean(result.stats && result.stats.updated === 1)
    },

    async ensureConversation(openid, conversationId, details) {
      const existing = await db.collection('conversations')
        .where({ _openid: openid, conversationId: conversationId })
        .limit(1)
        .get()
      if (existing.data.length > 0) return

      await db.collection('conversations').add({
        data: Object.assign({
          _openid: openid,
          conversationId: conversationId,
          lastMsg: '订单已进入指导阶段',
          lastTime: db.serverDate(),
          unread: 0
        }, details)
      })
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
