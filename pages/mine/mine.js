Page({
  data: {
    userInfo: {
      name: '微信用户',
      tag: '教育行业新人',
      id: 'UID000000',
      avatar: '新',
      role: 'student'
    },
    ongoingCount: 0,
    questionCount: 12,
    favoriteCount: 2,
    balance: '0.00',
    isMentor: false
  },

  onShow() {
    this.loadUserInfo()
    this.loadOngoingOrders()
    this.loadBalance()
  },

  loadOngoingOrders() {
    const orders = wx.getStorageSync('myOrders') || []
    const ongoing = orders.filter(item => item.status === 1).length
    this.setData({ ongoingCount: ongoing })
  },

  loadBalance() {
    let currentBalance = wx.getStorageSync('myBalance')
    if (!currentBalance && currentBalance !== 0) {
      currentBalance = 50.00
      wx.setStorageSync('myBalance', currentBalance)
    }
    this.setData({ balance: parseFloat(currentBalance).toFixed(2) })
  },

  loadUserInfo() {
    const stored = wx.getStorageSync('myProfile')
    if (stored) {
      this.setData({
        userInfo: stored,
        isMentor: stored.role === 'mentor'
      })
    }
  },

  goToProfile() { wx.navigateTo({ url: '/pages/profile/profile' }) },
  goToOrder() { wx.switchTab({ url: '/pages/order/order' }) },
  goToQuestions() { wx.navigateTo({ url: '/pages/questions/questions' }) },
  goToWallet() { wx.navigateTo({ url: '/pages/wallet/wallet' }) },
  goToFavorite() { wx.navigateTo({ url: '/pages/favorite/favorite' }) },
  goToHelp() { wx.navigateTo({ url: '/pages/help/help' }) },
  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确认要退出当前账号吗？',
      confirmColor: '#D14040',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('isLogged')
          wx.removeStorageSync('myProfile')
          wx.removeStorageSync('userRole')
          wx.redirectTo({ url: '/pages/login/login' })
        }
      }
    })
  }
})
