const { membershipId } = require('./membership-id')

function documentData(result) {
  if (!result) return null
  return Array.isArray(result.data) ? (result.data[0] || null) : (result.data || null)
}

function transactionValue(result) {
  return result && result.result && typeof result.result.status === 'string'
    ? result.result
    : result
}

async function membershipReference(transaction, openid, conversationId, legacyId) {
  const stableId = membershipId(openid, conversationId)
  const canonical = transaction.collection('conversations').doc(stableId)
  const stored = documentData(await canonical.get())
  if (stored) {
    if (stored._openid !== openid || stored.conversationId !== conversationId) {
      const error = new Error('Membership identity collision')
      error.code = 'MEMBERSHIP_ID_COLLISION'
      throw error
    }
    return { reference: canonical, exists: true }
  }
  if (legacyId && legacyId !== stableId) {
    const legacy = transaction.collection('conversations').doc(legacyId)
    const existing = documentData(await legacy.get())
    if (existing && existing._openid === openid && existing.conversationId === conversationId) {
      return { reference: legacy, exists: true }
    }
  }
  return { reference: canonical, exists: false }
}

function createCloudDatabaseAdapter(db) {
  async function legacyMembershipId(openid, conversationId) {
    const result = await db.collection('conversations')
      .where({ _openid: openid, conversationId }).limit(1).get()
    return result.data[0] ? result.data[0]._id : ''
  }

  return {
    async findApprovedMentor(openid) {
      const result = await db.collection('users')
        .where({ _openid: openid, role: 'mentor', mentorStatus: 'approved' })
        .limit(1).get()
      return result.data[0] || null
    },

    async claimOrderAtomically({ orderId, mentorId, openid }) {
      // Transactions support document references, not where queries. Discover legacy
      // IDs first, then re-read and validate every relevant document in the transaction.
      const before = documentData(await db.collection('orders').doc(orderId).get())
      if (!before) return { status: 'not-found' }
      if (typeof before._openid !== 'string' || !before._openid) return { status: 'invalid-order' }
      const conversationId = 'order_' + orderId
      const [studentLegacyId, mentorLegacyId] = await Promise.all([
        legacyMembershipId(before._openid, conversationId),
        legacyMembershipId(openid, conversationId)
      ])

      const result = await db.runTransaction(async transaction => {
        const orderReference = transaction.collection('orders').doc(orderId)
        const mentor = documentData(await transaction.collection('users').doc(mentorId).get())
        const order = documentData(await orderReference.get())
        if (!mentor || mentor._openid !== openid || mentor.role !== 'mentor' || mentor.mentorStatus !== 'approved') {
          return { status: 'not-approved' }
        }
        if (!order) return { status: 'not-found' }
        if (order._openid !== before._openid) return { status: 'order-changed' }
        if (order._openid === openid) return { status: 'self-claim' }
        const replay = order.status === 1 && order.teacherId === mentorId
        if (order.status !== 0 && !replay) return { status: 'conflict' }

        const studentMembership = await membershipReference(transaction, order._openid, conversationId, studentLegacyId)
        const mentorMembership = await membershipReference(transaction, openid, conversationId, mentorLegacyId)
        const anonymous = order.anonymous === true ||
          (order.typeText === '问诊室' && typeof order.title === 'string' && order.title.startsWith('【匿名】'))
        const participants = [
          { membership: studentMembership, owner: order._openid, role: 'student', name: mentor.name || '导师', theme: 'badge-primary' },
          { membership: mentorMembership, owner: openid, role: 'mentor', name: anonymous ? '匿名学员' : (order.student || '学员'), theme: 'badge-accent' }
        ]

        if (!replay) {
          await orderReference.update({ data: {
            status: 1,
            teacher: mentor.name || '导师',
            teacherId: mentorId,
            teacherAvatar: mentor.avatar || '师',
            claimTime: db.serverDate()
          } })
        }
        for (const participant of participants) {
          const details = {
            participantRole: participant.role,
            peerName: participant.name,
            peerTheme: participant.theme,
            orderTitle: anonymous ? '教育职场咨询' : (order.title || '')
          }
          if (participant.membership.exists) {
            // A retry must not erase message previews, timestamps or unread counts.
            await participant.membership.reference.update({ data: details })
          } else {
            await participant.membership.reference.set({ data: {
              _openid: participant.owner,
              conversationId,
              ...details,
              lastMsg: '订单已进入指导阶段',
              lastTime: db.serverDate(),
              unread: 0
            } })
          }
        }
        return { status: replay ? 'already-claimed' : 'claimed', teacher: mentor.name || '导师' }
      })
      return transactionValue(result)
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
