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
    this.loadProfile()
    this.loadStats()
  },

  loadProfile() {
    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.role === 'mentor') {
      this.setData({
        profile: {
          name: profile.name || '银龄教师',
          title: profile.title || '资深教师',
          subject: profile.subject || '待完善',
          years: profile.years || '0',
          avatar: profile.avatar || (profile.name ? profile.name[0] : '师'),
          id: profile.id || 'UID000000',
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

  showIncome() {
    wx.showModal({
      title: '收益明细',
      content:
        '今日收益：¥' + this.data.todayIncome + '\n' +
        '本月预估：¥' + this.data.monthIncome + '\n' +
        '累计收益：¥' + this.data.totalIncome,
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#2D5683'
    })
  },

  showCert() {
    wx.showModal({
      title: '名师认证',
      content: '您的资深教师认证已通过\n\n· 教师资格证 已上传\n· 学校/教研机构 已核验\n· 学科带头人 待补充材料',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#2D5683'
    })
  },

  showSchedule() {
    wx.showModal({
      title: '排班设置',
      content: '设置可接单的时间段，避免在休息时间收到打扰。\n（详细排班配置正在开发中）',
      showCancel: false,
      confirmText: '好的',
      confirmColor: '#2D5683'
    })
  },

  showReviews() {
    wx.showModal({
      title: '学员评价',
      content: '★ 4.9 / 共 118 条评价\n\n· "讲解非常细致，受益匪浅" — 周同学\n· "板书设计的思路点拨到位" — 林老师\n· "语言表达建议很专业" — 王老师',
      showCancel: false,
      confirmText: '查看更多',
      confirmColor: '#2D5683'
    })
  },

  showHelp() {
    wx.showModal({
      title: '导师指引',
      content: '· 在【工作台】查看并接单\n· 在【消息】中查看学员沟通\n· 长时间不在线请关闭「接单状态」\n· 收益满 1 元即可提现',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#2D5683'
    })
  },

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
