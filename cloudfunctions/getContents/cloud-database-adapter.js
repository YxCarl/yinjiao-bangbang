function createCloudDatabaseAdapter(db) {
  return {
    async getById(id) {
      const result = await db.collection('contents').doc(id).get()
      return result.data || null
    },
    async list(type, offset, limit) {
      let query = db.collection('contents')
      if (type) query = query.where({ type })
      const result = await query.orderBy('sort', 'asc').skip(offset).limit(limit).get()
      return result.data || []
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
