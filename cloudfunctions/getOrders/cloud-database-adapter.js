function createCloudDatabaseAdapter(db) {
  return {
    async findApprovedMentor(openid) {
      const result = await db.collection('users')
        .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
        .limit(1)
        .get()
      return result.data[0] || null
    },

    async listOrders(options) {
      let query = db.collection('orders')
      if (options.ownerOpenid) {
        query = query.where({ _openid: options.ownerOpenid })
      } else if (options.availableOnly) {
        query = query.where({ status: 0 })
      } else if (options.assignedMentorId) {
        query = query.where({ teacherId: options.assignedMentorId })
      } else {
        throw new Error('Order list must be scoped before querying')
      }
      const result = await query
        .orderBy('createTime', 'desc')
        .limit(options.limit)
        .get()
      return result.data
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
