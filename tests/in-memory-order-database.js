const { createCloudDatabaseAdapter } = require('../cloudfunctions/grabOrder/cloud-database-adapter')
const { TransactionalCloudDatabase } = require('./transactional-cloud-database')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryOrderDatabase {
  constructor(fixtures = {}) {
    this.users = clone(fixtures.users || [])
    this.orders = clone(fixtures.orders || [])
    this.conversations = clone(fixtures.conversations || [])
    this.clock = fixtures.clock || '2026-08-13T00:00:00.000Z'
    this.cloudDatabase = new TransactionalCloudDatabase(
      () => this.snapshot(),
      state => { Object.assign(this, state) },
      () => this.clock
    )
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

  async claimOrderAtomically(input) {
    return createCloudDatabaseAdapter(this.cloudDatabase).claimOrderAtomically(input)
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
