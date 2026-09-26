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
    wx.showModal({
      title: '演示页面',
      content: '本开源项目未接入微信支付或真实充值。余额仅用于流程演示，不会产生交易。',
      showCancel: false
    })
  }
})
