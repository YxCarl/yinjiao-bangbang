Page({
  data: {
    profile: {
      name: '银龄教师',
      title: '未填写职称',
      subject: '待完善',
      years: '0',
      avatar: '师',
      id: 'UID000000',
      rating: '—'
    },
    balance: '—',
    todayIncome: '—',
    monthIncome: '—',
    totalIncome: '—',
    totalOrders: 0,
    completionRate: '—',
    msgUnread: 0,
    certified: false,
    onlineStatus: true
  },

  onShow() {
    this.refreshFromCloud()
  },

  refreshFromCloud() {
    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: 'mentor' },
      success: (res) => {
        const profile = res.result && res.result.code === 0 ? res.result.data : null
        if (!(profile && profile.role === 'mentor' && profile.mentorStatus === 'approved')) {
          this._redirectToApplication()
          return
        }
        wx.setStorageSync('myProfile', profile)
        wx.setStorageSync('userId', profile._id)
        wx.setStorageSync('userRole', 'mentor')
        this.loadProfile(profile)
        this.setData({ certified: true })
        this.loadStats()
      },
      fail: () => {
        wx.showToast({ title: '暂时无法验证导师身份', icon: 'none' })
        setTimeout(() => { wx.redirectTo({ url: '/pages/login/login' }) }, 600)
      }
    })
  },

  _redirectToApplication() {
    wx.setStorageSync('userRole', 'student')
    wx.showToast({ title: '导师身份尚未通过审核', icon: 'none' })
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/teacher-cert/teacher-cert' })
    }, 600)
  },

  loadProfile(profile) {
    if (!profile) profile = wx.getStorageSync('myProfile')
    if (profile && profile.role === 'mentor' && profile.mentorStatus === 'approved') {
      this.setData({
        profile: {
          name: profile.name || '银龄教师',
          title: profile.title || '未填写职称',
          subject: profile.subject || '待完善',
          years: profile.years || '0',
          avatar: profile.avatar || (profile.name ? profile.name[0] : '师'),
          id: profile._id || profile.id || 'UID000000',
          rating: '—'
        }
      })
    }
    const onlineStatus = wx.getStorageSync('mentorOnline')
    if (onlineStatus !== '' && onlineStatus !== null && onlineStatus !== undefined) {
      this.setData({ onlineStatus: !!onlineStatus })
    }
  },

  loadStats() {
    wx.cloud.callFunction({
      name: 'getOrders',
      data: { scope: 'all' },
      success: (res) => {
        if (!(res.result && res.result.code === 0)) return
        const assigned = res.result.data.filter(order => order.status === 1 || order.status === 2)
        this.setData({ totalOrders: assigned.length })
      },
      fail: () => { this.setData({ totalOrders: 0 }) }
    })
  },

  toggleOnline() {
    const next = !this.data.onlineStatus
    this.setData({ onlineStatus: next })
    wx.setStorageSync('mentorOnline', next)
    wx.showToast({
      title: '仅本机演示，不影响接单',
      icon: 'none'
    })
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  doWithdraw() {
    wx.showModal({
      title: '提现不可用',
      content: '演示版未接入真实收入、结算或微信提现，不会提交提现申请。',
      showCancel: false
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
