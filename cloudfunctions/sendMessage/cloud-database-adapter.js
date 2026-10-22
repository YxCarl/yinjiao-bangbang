const { membershipId } = require('./membership-id')

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

async function transactionAccess(transaction, input) {
  const senderReference = transaction.collection('conversations').doc(input.membershipId)
  const sender = documentData(await senderReference.get())
  if (!sender || sender._openid !== input.openid || sender.conversationId !== input.conversationId) return null

  let allowedPeers = null
  if (input.conversationId.startsWith('order_')) {
    const orderId = input.conversationId.slice('order_'.length)
    if (!orderId) return null
    const order = documentData(await transaction.collection('orders').doc(orderId).get())
    if (!order || typeof order._openid !== 'string' || !order._openid) return null
    const mentor = typeof order.teacherId === 'string' && order.teacherId
      ? documentData(await transaction.collection('users').doc(order.teacherId).get())
      : null
    const approved = mentor && mentor.role === 'mentor' && mentor.mentorStatus === 'approved' &&
      typeof mentor._openid === 'string' && mentor._openid
    if (order._openid !== input.openid && !(approved && mentor._openid === input.openid)) return null
    allowedPeers = new Set([order._openid, ...(approved ? [mentor._openid] : [])])
  }

  // The preflight query only discovers IDs. Recheck every document in the
  // transaction before publishing message previews or incrementing unread.
  const peerReferences = []
  for (const id of new Set(input.peerMembershipIds)) {
    const reference = transaction.collection('conversations').doc(id)
    const peer = documentData(await reference.get())
    if (peer && peer.conversationId === input.conversationId && peer._openid &&
        peer._openid !== input.openid && (!allowedPeers || allowedPeers.has(peer._openid))) {
      peerReferences.push(reference)
    }
  }
  return { senderReference, peerReferences }
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
      const stableId = membershipId(openid, conversationId)
      const result = await db.runTransaction(async transaction => {
        const reference = transaction.collection('conversations').doc(stableId)
        const existing = documentData(await reference.get())
        if (existing) {
          if (existing._openid !== openid || existing.conversationId !== conversationId) {
            const error = new Error('Membership identity collision')
            error.code = 'MEMBERSHIP_ID_COLLISION'
            throw error
          }
          return { status: 'existing', _id: stableId }
        }
        await reference.set({ data: {
          _openid: openid,
          conversationId: conversationId,
          participantRole: details.participantRole,
          peerName: details.peerName,
          orderTitle: details.orderTitle,
          lastMsg: '',
          lastTime: db.serverDate(),
          unread: 0
        } })
        return { status: 'created', _id: stableId }
      })
      return { _id: transactionValue(result)._id }
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
        const access = await transactionAccess(transaction, input)
        if (!access) return { status: 'forbidden' }
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

        await access.senderReference.update({
          data: { lastMsg: input.preview, lastTime: db.serverDate() }
        })
        for (const reference of access.peerReferences) {
          await reference.update({
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
