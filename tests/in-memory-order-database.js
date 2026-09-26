function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryOrderDatabase {
  constructor(fixtures = {}) {
    this.users = clone(fixtures.users || [])
    this.orders = clone(fixtures.orders || [])
    this.conversations = clone(fixtures.conversations || [])
    this.clock = fixtures.clock || '2026-08-13T00:00:00.000Z'
  }

  async findApprovedMentor(openid) {
    const mentor = this.users.find(user => (
      user._openid === openid &&
      user.role === 'mentor' &&
      user.mentorStatus === 'approved'
    ))
    return mentor ? clone(mentor) : null
  }

  async listOrders(options) {
    if (!options.ownerOpenid && !options.availableOnly && !options.assignedMentorId) {
      throw new Error('Order list must be scoped before querying')
    }
    return this.orders
      .filter(order => (
        (options.ownerOpenid && order._openid === options.ownerOpenid) ||
        (options.availableOnly && order.status === 0) ||
        (options.assignedMentorId && order.teacherId === options.assignedMentorId)
      ))
      .sort((left, right) => String(right.createTime).localeCompare(String(left.createTime)))
      .slice(0, options.limit)
      .map(clone)
  }

  async getOrder(orderId) {
    const order = this.orders.find(item => item._id === orderId)
    return order ? clone(order) : null
  }

  async claimOpenOrder(orderId, mentor) {
    const order = this.orders.find(item => item._id === orderId && item.status === 0)
    if (!order) return false
    Object.assign(order, {
      status: 1,
      teacher: mentor.name || '导师',
      teacherId: mentor._id,
      teacherAvatar: mentor.avatar || '师',
      claimTime: this.clock
    })
    return true
  }

  async ensureConversation(openid, conversationId, details) {
    const exists = this.conversations.some(item => (
      item._openid === openid && item.conversationId === conversationId
    ))
    if (exists) return
    this.conversations.push(Object.assign({
      _id: `conversation-${this.conversations.length + 1}`,
      _openid: openid,
      conversationId: conversationId,
      lastMsg: '订单已进入指导阶段',
      lastTime: this.clock,
      unread: 0
    }, clone(details)))
  }

  async completeAssignedOrder(orderId, mentorId) {
    const order = this.orders.find(item => (
      item._id === orderId && item.teacherId === mentorId && item.status === 1
    ))
    if (!order) return false
    order.status = 2
    order.completeTime = this.clock
    return true
  }

  snapshot() {
    return clone({
      users: this.users,
      orders: this.orders,
      conversations: this.conversations
    })
  }
}

module.exports = { InMemoryOrderDatabase }
