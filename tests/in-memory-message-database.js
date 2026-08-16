function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryMessageDatabase {
  constructor(fixtures = {}) {
    this.users = clone(fixtures.users || [])
    this.orders = clone(fixtures.orders || [])
    this.conversations = clone(fixtures.conversations || [])
    this.messages = clone(fixtures.messages || [])
    this.rateLimits = clone(fixtures.rateLimits || [])
    this.clock = fixtures.clock || '2026-08-14T00:00:00.000Z'
  }

  async getMembership(openid, conversationId) {
    const membership = this.conversations.find(item => (
      item._openid === openid && item.conversationId === conversationId
    ))
    return membership ? clone(membership) : null
  }

  async getOrder(orderId) {
    const order = this.orders.find(item => item._id === orderId)
    return order ? clone(order) : null
  }

  async getUser(userId) {
    const user = this.users.find(item => item._id === userId)
    return user ? clone(user) : null
  }

  async findApprovedMentor(openid) {
    const mentor = this.users.find(user => (
      user._openid === openid &&
      user.role === 'mentor' &&
      user.mentorStatus === 'approved'
    ))
    return mentor ? clone(mentor) : null
  }

  async findApprovedMentors(openid) {
    return this.users
      .filter(user => (
        user._openid === openid &&
        user.role === 'mentor' &&
        user.mentorStatus === 'approved'
      ))
      .map(clone)
  }

  async listMessages(conversationId) {
    return this.messages
      .filter(message => message.conversationId === conversationId)
      .sort((left, right) => String(left.createTime).localeCompare(String(right.createTime)))
      .map(clone)
  }

  async listConversations(openid) {
    return this.conversations
      .filter(conversation => conversation._openid === openid)
      .sort((left, right) => String(right.lastTime).localeCompare(String(left.lastTime)))
      .map(clone)
  }

  async createMembership(openid, conversationId, details) {
    const membership = {
      _id: `conversation-${this.conversations.length + 1}`,
      _openid: openid,
      conversationId: conversationId,
      participantRole: details.participantRole,
      peerName: details.peerName,
      orderTitle: details.orderTitle,
      lastMsg: '',
      lastTime: this.clock,
      unread: 0
    }
    this.conversations.push(membership)
    return clone(membership)
  }

  async markMembershipRead(membershipId) {
    const membership = this.conversations.find(item => item._id === membershipId)
    if (membership) membership.unread = 0
  }

  async listPeerMembershipIds(conversationId, senderOpenid, allowedPeerOpenids) {
    return this.conversations
      .filter(item => (
        item.conversationId === conversationId &&
        item._openid !== senderOpenid &&
        (allowedPeerOpenids === null || allowedPeerOpenids.includes(item._openid))
      ))
      .map(item => item._id)
  }

  async commitMessage(input) {
    if (!Array.isArray(input.peerMembershipIds) || input.peerMembershipIds.length > 20) {
      const invalidPeers = new Error('Conversation has too many peer memberships')
      invalidPeers.code = 'PEER_MEMBERSHIP_LIMIT'
      throw invalidPeers
    }
    const existing = this.messages.find(message => message._id === input.messageId)
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

    let rate = this.rateLimits.find(item => item._id === input.rateLimitId)
    const currentCount = rate && rate.windowStartMs === input.windowStartMs
      ? Number(rate.count || 0)
      : 0
    if (currentCount >= input.maximumMessages) return { status: 'rate-limited' }

    const senderMembership = this.conversations.find(item => item._id === input.membershipId)
    const peerMemberships = input.peerMembershipIds
      .map(id => this.conversations.find(item => item._id === id))
    if (!senderMembership || peerMemberships.some(item => !item)) {
      const missing = new Error('Conversation membership missing during transaction')
      missing.code = 'MEMBERSHIP_MISSING'
      throw missing
    }

    if (!rate) {
      rate = { _id: input.rateLimitId }
      this.rateLimits.push(rate)
    }
    Object.assign(rate, {
      _openid: input.openid,
      scope: 'sendMessage',
      windowStartMs: input.windowStartMs,
      count: currentCount + 1,
      expiresAt: new Date(input.rateLimitExpiresAtMs).toISOString()
    })
    this.messages.push({
      _id: input.messageId,
      _openid: input.openid,
      requestId: input.requestId,
      conversationId: input.conversationId,
      kind: input.kind,
      content: input.content,
      fileID: input.fileID,
      dur: input.dur,
      isRead: false,
      createTime: this.clock
    })
    senderMembership.lastMsg = input.preview
    senderMembership.lastTime = this.clock
    peerMemberships.forEach(item => {
      item.lastMsg = input.preview
      item.lastTime = this.clock
      item.unread = Number(item.unread || 0) + 1
    })
    return { status: 'created' }
  }

  snapshot() {
    return clone({
      users: this.users,
      orders: this.orders,
      conversations: this.conversations,
      messages: this.messages,
      rateLimits: this.rateLimits
    })
  }
}

module.exports = { InMemoryMessageDatabase }
