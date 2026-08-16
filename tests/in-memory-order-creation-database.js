function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class InMemoryOrderCreationDatabase {
  constructor(fixtures = {}) {
    this.users = clone(fixtures.users || [])
    this.orders = clone(fixtures.orders || [])
    this.aiTasks = clone(fixtures.aiTasks || [])
    this.rateLimits = clone(fixtures.rateLimits || [])
    this.clock = fixtures.clock || '2026-08-14T14:00:00.000Z'
    this.failAfterBalanceUpdate = false
  }

  async findStudentProfile(openid) {
    const student = this.users.find(user => (
      user._openid === openid && user.role === 'student'
    ))
    return student ? clone(student) : null
  }

  async getOrder(orderId) {
    const order = this.orders.find(item => item._id === orderId)
    return order ? clone(order) : null
  }

  async getAiTask(taskId) {
    const task = this.aiTasks.find(item => item._id === taskId)
    return task ? clone(task) : null
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
    let analysisTask = null
    if (input.analysisTaskId) {
      analysisTask = this.aiTasks.find(item => item._id === input.analysisTaskId)
      if (
        !analysisTask ||
        analysisTask._openid !== input.openid ||
        analysisTask.status !== 'done' ||
        analysisTask.fileID !== input.analysisFileID ||
        analysisTask.cleanupState === 'deleting'
      ) {
        return { status: 'analysis-invalid', balance: balance }
      }
      if (analysisTask.orderId && analysisTask.orderId !== input.orderId) {
        return { status: 'analysis-used', balance: balance }
      }
    }

    if (balance < input.price) {
      return {
        status: 'insufficient-balance',
        balance: balance
      }
    }

    let rate = this.rateLimits.find(item => item._id === input.rateLimitId)
    const currentCount = rate && rate.windowStartMs === input.windowStartMs
      ? Number(rate.count || 0)
      : 0
    if (currentCount >= input.maximumOrders) {
      return { status: 'rate-limited', balance: balance }
    }

    const previousBalance = user.balance
    const previousOrderCount = this.orders.length
    const previousRateLimits = clone(this.rateLimits)
    const previousAiTasks = clone(this.aiTasks)
    try {
      const newBalance = Math.round((balance - input.price) * 100) / 100
      if (!rate) {
        rate = { _id: input.rateLimitId }
        this.rateLimits.push(rate)
      }
      Object.assign(rate, {
        _openid: input.openid,
        scope: 'addOrder',
        windowStartMs: input.windowStartMs,
        count: currentCount + 1,
        expiresAt: new Date(input.rateLimitExpiresAtMs).toISOString()
      })
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
      if (analysisTask) {
        Object.assign(analysisTask, {
          orderId: input.orderId,
          orderedAtMs: input.createdAtMs,
          cleanupEligible: false,
          cleanupState: 'order-bound'
        })
      }
      return { status: 'created', balance: newBalance }
    } catch (error) {
      user.balance = previousBalance
      this.orders.length = previousOrderCount
      this.rateLimits = previousRateLimits
      this.aiTasks = previousAiTasks
      throw error
    }
  }

  snapshot() {
    return clone({
      users: this.users,
      orders: this.orders,
      aiTasks: this.aiTasks,
      rateLimits: this.rateLimits
    })
  }
}

module.exports = { InMemoryOrderCreationDatabase }
