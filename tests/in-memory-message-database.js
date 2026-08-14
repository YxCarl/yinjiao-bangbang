function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryMessageDatabase {
  constructor(fixtures = {}) {
    this.users = clone(fixtures.users || [])
    this.orders = clone(fixtures.orders || [])
    this.conversations = clone(fixtures.conversations || [])
    this.messages = clone(fixtures.messages || [])
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

  async addMessage(message) {
    this.messages.push({
      _id: `message-${this.messages.length + 1}`,
      _openid: message.openid,
      conversationId: message.conversationId,
      kind: message.kind,
      content: message.content,
      fileID: message.fileID,
      dur: message.dur,
      isRead: false,
      createTime: this.clock
    })
  }

  async updateMembershipPreview(membershipId, preview) {
    const membership = this.conversations.find(item => item._id === membershipId)
    if (!membership) return
    membership.lastMsg = preview
    membership.lastTime = this.clock
  }

  async incrementPeerUnread(conversationId, senderOpenid, preview, allowedPeerOpenids) {
    this.conversations
      .filter(item => (
        item.conversationId === conversationId &&
        item._openid !== senderOpenid &&
        (allowedPeerOpenids === null || allowedPeerOpenids.includes(item._openid))
      ))
      .forEach(item => {
        item.lastMsg = preview
        item.lastTime = this.clock
        item.unread = Number(item.unread || 0) + 1
      })
  }

  snapshot() {
    return clone({
      users: this.users,
      orders: this.orders,
      conversations: this.conversations,
      messages: this.messages
    })
  }
}

module.exports = { InMemoryMessageDatabase }
