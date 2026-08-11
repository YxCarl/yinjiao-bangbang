Page({
  data: {
    balance: '0.00',
    selectedIndex: 1,
    rechargeOptions: [
      { price: 49, give: 0 },
      { price: 99, give: 10 },
      { price: 199, give: 30 },
      { price: 299, give: 60 }
    ]
  },

  onShow() {
    this.syncBalance()
  },

  syncBalance() {
    const profile = wx.getStorageSync('myProfile') || {}
    this.setData({ balance: parseFloat(profile.balance || 0).toFixed(2) })
  },

  selectOption(e) {
    this.setData({ selectedIndex: e.currentTarget.dataset.index })
  },

  payRecharge() {
    const option = this.data.rechargeOptions[this.data.selectedIndex]
    const totalAdd = option.price + option.give

    wx.showLoading({ title: '支付处理中...' })

    const profile = wx.getStorageSync('myProfile') || {}
    const oldBalance = parseFloat(profile.balance || 0)
    const newBalance = oldBalance + totalAdd

    // 更新本地
    profile.balance = newBalance
    wx.setStorageSync('myProfile', profile)
    this.setData({ balance: newBalance.toFixed(2) })

    wx.hideLoading()
    wx.showToast({ title: '演示余额已更新', icon: 'none' })
  }
})
