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

    async listMessages(conversationId, { cursor = null, direction = 'before', limit = 51 } = {}) {
      const ascending = direction === 'after'
      let condition = { conversationId }
      if (cursor) {
        const command = db.command
        const compare = value => ascending ? command.gt(value) : command.lt(value)
        const time = new Date(cursor.time)
        condition = command.and(condition, command.or(
          { createTime: compare(time) },
          { createTime: time, _id: compare(cursor.id) }
        ))
      }
      const result = await db.collection('messages')
        .where(condition)
        .orderBy('createTime', ascending ? 'asc' : 'desc')
        .orderBy('_id', ascending ? 'asc' : 'desc')
        .limit(limit)
        .get()
      return result.data || []
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
