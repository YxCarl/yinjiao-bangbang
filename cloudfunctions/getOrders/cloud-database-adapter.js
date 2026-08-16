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
