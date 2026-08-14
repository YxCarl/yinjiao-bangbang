function createCloudDatabaseAdapter(db) {
  const command = db.command

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

    async getUser(userId) {
      try {
        const result = await db.collection('users').doc(userId).get()
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

    async createMembership(openid, conversationId, details) {
      const result = await db.collection('conversations').add({
        data: {
          _openid: openid,
          conversationId: conversationId,
          participantRole: details.participantRole,
          peerName: details.peerName,
          orderTitle: details.orderTitle,
          lastMsg: '',
          lastTime: db.serverDate(),
          unread: 0
        }
      })
      return { _id: result._id }
    },

    async markMembershipRead(membershipId) {
      await db.collection('conversations').doc(membershipId).update({
        data: { unread: 0 }
      })
    },

    async addMessage(message) {
      await db.collection('messages').add({
        data: {
          _openid: message.openid,
          conversationId: message.conversationId,
          kind: message.kind,
          content: message.content,
          fileID: message.fileID,
          dur: message.dur,
          isRead: false,
          createTime: db.serverDate()
        }
      })
    },

    async updateMembershipPreview(membershipId, preview) {
      await db.collection('conversations').doc(membershipId).update({
        data: { lastMsg: preview, lastTime: db.serverDate() }
      })
    },

    async incrementPeerUnread(conversationId, senderOpenid, preview, allowedPeerOpenids) {
      const result = await db.collection('conversations')
        .where({ conversationId: conversationId })
        .get()
      const updates = result.data
        .filter(item => (
          item._openid !== senderOpenid &&
          (allowedPeerOpenids === null || allowedPeerOpenids.includes(item._openid))
        ))
        .map(item => db.collection('conversations').doc(item._id).update({
          data: {
            lastMsg: preview,
            lastTime: db.serverDate(),
            unread: command.inc(1)
          }
        }))
      await Promise.all(updates)
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
