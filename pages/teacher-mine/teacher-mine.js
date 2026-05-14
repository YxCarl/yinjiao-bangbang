Page({
  data: {
    profile: {
      name: '银龄教师',
      title: '资深教师',
      subject: '待完善',
      years: '0',
      avatar: '师',
      id: 'UID000000',
      rating: '5.0'
    },
    balance: '0.00',
    todayIncome: '0.00',
    monthIncome: '0.00',
    totalIncome: '0.00',
    totalOrders: 0,
    completionRate: '98',
    msgUnread: 0,
    certified: true,
    onlineStatus: true
  },

  onShow() {
    this.refreshFromCloud()
    this.loadStats()
  },

  refreshFromCloud() {
    const role = wx.getStorageSync('userRole')
    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: role || 'mentor' },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          wx.setStorageSync('myProfile', res.result.data)
          wx.setStorageSync('userId', res.result.data._id)
          this.loadProfile(res.result.data)
        } else {
          this.loadProfile()
        }
      },
      fail: () => { this.loadProfile() }
    })
  },

  loadProfile(profile) {
    if (!profile) profile = wx.getStorageSync('myProfile')
    if (profile && profile.role === 'mentor') {
      this.setData({
        profile: {
          name: profile.name || '银龄教师',
          title: profile.title || '资深教师',
          subject: profile.subject || '待完善',
          years: profile.years || '0',
          avatar: profile.avatar || (profile.name ? profile.name[0] : '师'),
          id: profile._id || profile.id || 'UID000000',
          rating: profile.rating || '5.0'
        }
      })
    }
    const onlineStatus = wx.getStorageSync('mentorOnline')
    if (onlineStatus !== '' && onlineStatus !== null && onlineStatus !== undefined) {
      this.setData({ onlineStatus: !!onlineStatus })
    }
  },

  loadStats() {
    let bal = wx.getStorageSync('mentorBalance')
    if (bal === '' || bal === null || bal === undefined) {
      bal = 1280.00
      wx.setStorageSync('mentorBalance', bal)
    }
    this.setData({
      balance: parseFloat(bal).toFixed(2),
      todayIncome: '320.00',
      monthIncome: '1,280.00',
      totalIncome: '8,640.00',
      totalOrders: 328
    })
  },

  toggleOnline() {
    const next = !this.data.onlineStatus
    this.setData({ onlineStatus: next })
    wx.setStorageSync('mentorOnline', next)
    wx.showToast({
      title: next ? '已上线 · 可接单' : '已下线 · 暂停接单',
      icon: 'none'
    })
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  doWithdraw() {
    if (parseFloat(this.data.balance) <= 0) {
      wx.showToast({ title: '暂无可提现金额', icon: 'none' })
      return
    }
    wx.showModal({
      title: '提现申请',
      content: '可提现金额 ¥' + this.data.balance + '\n确认申请提现至微信钱包？',
      confirmText: '申请提现',
      confirmColor: '#C8924E',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('mentorBalance', 0)
          this.setData({ balance: '0.00' })
          wx.showToast({ title: '已提交，1-3工作日到账', icon: 'none' })
        }
      }
    })
  },

  showIncome() { wx.navigateTo({ url: '/pages/teacher-income/teacher-income' }) },
  showCert() { wx.navigateTo({ url: '/pages/teacher-cert/teacher-cert' }) },
  showSchedule() { wx.navigateTo({ url: '/pages/teacher-schedule/teacher-schedule' }) },
  showReviews() { wx.navigateTo({ url: '/pages/reviews/reviews' }) },
  showHelp() { wx.navigateTo({ url: '/pages/help/help' }) },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确认要退出导师账号吗？',
      confirmColor: '#D14040',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('isLogged')
          wx.removeStorageSync('myProfile')
          wx.removeStorageSync('userRole')
          wx.removeStorageSync('mentorOnline')
          wx.redirectTo({ url: '/pages/login/login' })
        }
      }
    })
  },

  navHome() { wx.redirectTo({ url: '/pages/teacher/teacher' }) },
  navMsg() { wx.redirectTo({ url: '/pages/teacher-msg/teacher-msg' }) },
  navMine() { /* 已在我的 */ }
})
