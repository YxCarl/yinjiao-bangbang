function documentData(result) {
  if (!result) return null
  if (Array.isArray(result.data)) return result.data[0] || null
  return result.data || null
}

function transactionValue(result) {
  if (
    result &&
    result.result &&
    typeof result.result.status === 'string'
  ) {
    return result.result
  }
  return result
}

function createCloudDatabaseAdapter(db) {
  return {
    async findStudentProfile(openid) {
      const result = await db.collection('users')
        .where({ _openid: openid, role: 'student' })
        .limit(1)
        .get()
      return result.data[0] || null
    },

    async createOrderAtomically(input) {
      const result = await db.runTransaction(async transaction => {
        const userReference = transaction.collection('users').doc(input.userId)
        const orderReference = transaction.collection('orders').doc(input.orderId)
        const userResult = await userReference.get()
        const orderResult = await orderReference.get()
        const user = documentData(userResult)
        const existingOrder = documentData(orderResult)

        if (!user || user._openid !== input.openid || user.role !== 'student') {
          return { status: 'user-not-found' }
        }

        const balance = Number(user.balance || 0)
        if (!Number.isFinite(balance)) {
          const invalidBalance = new Error('Invalid stored balance')
          invalidBalance.code = 'INVALID_STORED_BALANCE'
          throw invalidBalance
        }
        if (existingOrder) {
          if (
            existingOrder._openid !== input.openid ||
            existingOrder.requestId !== input.requestId
          ) {
            const collision = new Error('Deterministic order ID collision')
            collision.code = 'ORDER_ID_COLLISION'
            throw collision
          }
          return { status: 'duplicate', balance: balance }
        }

        if (balance < input.price) {
          return {
            status: 'insufficient-balance',
            balance: balance
          }
        }

        const rateReference = transaction.collection('rateLimits').doc(input.rateLimitId)
        const rateResult = await rateReference.get()
        const rate = documentData(rateResult)
        const currentCount = rate && rate.windowStartMs === input.windowStartMs
          ? Number(rate.count || 0)
          : 0
        if (currentCount >= input.maximumOrders) {
          return { status: 'rate-limited', balance: balance }
        }

        const newBalance = Math.round((balance - input.price) * 100) / 100
        await rateReference.set({
          data: {
            _openid: input.openid,
            scope: 'addOrder',
            windowStartMs: input.windowStartMs,
            count: currentCount + 1,
            expiresAt: new Date(input.rateLimitExpiresAtMs)
          }
        })
        await userReference.update({ data: { balance: newBalance } })
        await orderReference.set({
          data: {
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
            createTime: db.serverDate(),
            detail: input.order.detail
          }
        })

        return { status: 'created', balance: newBalance }
      })

      return transactionValue(result)
    }
  }
}

module.exports = { createCloudDatabaseAdapter }
