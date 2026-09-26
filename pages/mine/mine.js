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
    questionCount: 0,
    favoriteCount: 0,
    balance: '0.00',
    isMentor: false
  },

  onShow() {
    this.refreshFromCloud()
    this.loadOngoingOrders()
    this.loadBalance()
  },

  refreshFromCloud() {
    const role = wx.getStorageSync('userRole')
    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: role || 'student' },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          wx.setStorageSync('myProfile', res.result.data)
          wx.setStorageSync('userId', res.result.data._id)
          this.loadUserInfo(res.result.data)
        } else {
          this.loadUserInfo()
        }
      },
      fail: () => { this.loadUserInfo() }
    })
  },

  loadOngoingOrders() {
    wx.cloud.callFunction({
      name: 'getOrders',
      success: (res) => {
        if (res.result && res.result.code === 0) {
          const ongoing = res.result.data.filter(item => item.status === 1).length
          this.setData({ ongoingCount: ongoing })
        }
      },
      fail: () => {}
    })
  },

  loadBalance() {
    const profile = wx.getStorageSync('myProfile') || {}
    const bal = parseFloat(profile.balance || 0)
    this.setData({ balance: bal.toFixed(2) })
  },

  loadUserInfo(stored) {
    if (!stored) stored = wx.getStorageSync('myProfile')
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
