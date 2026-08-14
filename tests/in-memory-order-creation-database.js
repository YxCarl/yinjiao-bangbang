function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryOrderCreationDatabase {
  constructor(fixtures = {}) {
    this.users = clone(fixtures.users || [])
    this.orders = clone(fixtures.orders || [])
    this.clock = fixtures.clock || '2026-08-14T14:00:00.000Z'
    this.failAfterBalanceUpdate = false
  }

  async findStudentProfile(openid) {
    const student = this.users.find(user => (
      user._openid === openid && user.role === 'student'
    ))
    return student ? clone(student) : null
  }

  async createOrderAtomically(input) {
    const user = this.users.find(item => item._id === input.userId)
    if (!user || user._openid !== input.openid || user.role !== 'student') {
      return { status: 'user-not-found' }
    }

    const existing = this.orders.find(order => order._id === input.orderId)
    if (existing) {
      if (existing._openid !== input.openid || existing.requestId !== input.requestId) {
        const collision = new Error('Deterministic order ID collision')
        collision.code = 'ORDER_ID_COLLISION'
        throw collision
      }
      return { status: 'duplicate', balance: Number(user.balance || 0) }
    }

    const balance = Number(user.balance || 0)
    if (!Number.isFinite(balance)) {
      const invalidBalance = new Error('Invalid stored balance')
      invalidBalance.code = 'INVALID_STORED_BALANCE'
      throw invalidBalance
    }
    if (balance < input.price) {
      return {
        status: 'insufficient-balance',
        balance: balance
      }
    }

    const previousBalance = user.balance
    const previousOrderCount = this.orders.length
    try {
      const newBalance = Math.round((balance - input.price) * 100) / 100
      user.balance = newBalance
      if (this.failAfterBalanceUpdate) throw new Error('simulated order write failure')

      this.orders.push({
        _id: input.orderId,
        _openid: input.openid,
        requestId: input.requestId,
        typeText: input.order.typeText,
        title: input.order.title,
        price: input.price,
        status: 0,
        studentId: input.userId,
        student: input.order.student,
        studentAvatar: input.order.studentAvatar,
        desc: input.order.desc,
        createTime: this.clock,
        detail: clone(input.order.detail)
      })
      return { status: 'created', balance: newBalance }
    } catch (error) {
      user.balance = previousBalance
      this.orders.length = previousOrderCount
      throw error
    }
  }

  snapshot() {
    return clone({ users: this.users, orders: this.orders })
  }
}

module.exports = { InMemoryOrderCreationDatabase }
