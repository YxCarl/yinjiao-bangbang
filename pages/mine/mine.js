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
  goToHelp() {
    wx.showModal({
      title: '使用指南',
      content: '欢迎使用「师傅在吗」。\n\n· 在【首页】发布磨课、诊课需求\n· 名师接单后将提供专属指导\n· 困惑可至【问诊室】匿名提问\n· 如您是银龄/资深教师，请退出后选择「银龄导师」身份重新登录',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#2D5683'
    })
  },
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
