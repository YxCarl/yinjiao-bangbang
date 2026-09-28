function createCloudDatabaseAdapter(db) {
  return {
    async listConversations(openid, { cursor = null, limit = 50 } = {}) {
      let condition = { _openid: openid }
      if (cursor) {
        const command = db.command
        const time = new Date(cursor.time)
        condition = command.and(condition, command.or(
          { lastTime: command.lt(time) },
          { lastTime: time, _id: command.lt(cursor.id) }
        ))
      }
      const result = await db.collection('conversations')
        .where(condition)
        .orderBy('lastTime', 'desc')
        .orderBy('_id', 'desc')
        .limit(limit)
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
