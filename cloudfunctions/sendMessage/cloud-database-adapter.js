function documentData(result) {
  if (!result) return null
  if (Array.isArray(result.data)) return result.data[0] || null
  return result.data || null
}

function transactionValue(result) {
  if (result && result.result && typeof result.result.status === 'string') {
    return result.result
  }
  return result
}

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

    async listPeerMembershipIds(conversationId, senderOpenid, allowedPeerOpenids) {
      const result = await db.collection('conversations')
        .where({ conversationId: conversationId })
        .get()
      return result.data
        .filter(item => (
          item._openid !== senderOpenid &&
          (allowedPeerOpenids === null || allowedPeerOpenids.includes(item._openid))
        ))
        .map(item => item._id)
    },

    async commitMessage(input) {
      if (!Array.isArray(input.peerMembershipIds) || input.peerMembershipIds.length > 20) {
        const invalidPeers = new Error('Conversation has too many peer memberships')
        invalidPeers.code = 'PEER_MEMBERSHIP_LIMIT'
        throw invalidPeers
      }
      const result = await db.runTransaction(async transaction => {
        const messageReference = transaction.collection('messages').doc(input.messageId)
        const rateReference = transaction.collection('rateLimits').doc(input.rateLimitId)
        const existingResult = await messageReference.get()
        const existing = documentData(existingResult)

        if (existing) {
          if (
            existing._openid !== input.openid ||
            existing.requestId !== input.requestId ||
            existing.conversationId !== input.conversationId
          ) {
            const collision = new Error('Deterministic message ID collision')
            collision.code = 'MESSAGE_ID_COLLISION'
            throw collision
          }
          return { status: 'duplicate' }
        }

        const rateResult = await rateReference.get()
        const rate = documentData(rateResult)
        const currentCount = rate && rate.windowStartMs === input.windowStartMs
          ? Number(rate.count || 0)
          : 0
        if (currentCount >= input.maximumMessages) return { status: 'rate-limited' }

        await rateReference.set({
          data: {
            _openid: input.openid,
            scope: 'sendMessage',
            windowStartMs: input.windowStartMs,
            count: currentCount + 1,
            expiresAt: new Date(input.rateLimitExpiresAtMs)
          }
        })

        await messageReference.set({
          data: {
            _openid: input.openid,
            requestId: input.requestId,
            conversationId: input.conversationId,
            kind: input.kind,
            content: input.content,
            fileID: input.fileID,
            dur: input.dur,
            isRead: false,
            createTime: db.serverDate()
          }
        })

        await transaction.collection('conversations').doc(input.membershipId).update({
          data: { lastMsg: input.preview, lastTime: db.serverDate() }
        })
        for (const membershipId of input.peerMembershipIds) {
          await transaction.collection('conversations').doc(membershipId).update({
            data: {
              lastMsg: input.preview,
              lastTime: db.serverDate(),
              unread: command.inc(1)
            }
          })
        }
        return { status: 'created' }
      })
      return transactionValue(result)
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
