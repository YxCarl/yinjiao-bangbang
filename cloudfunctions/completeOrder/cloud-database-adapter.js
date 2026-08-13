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

    async completeAssignedOrder(orderId, mentorId) {
      const result = await db.collection('orders')
        .where({ _id: orderId, teacherId: mentorId, status: 1 })
        .update({
          data: {
            status: 2,
            completeTime: db.serverDate()
          }
        })
      return Boolean(result.stats && result.stats.updated === 1)
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
