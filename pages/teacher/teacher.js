Page({
  data: {
    currentTab: 0,
    teacherName: '导师',
    teacherTitle: '资料加载中',
    todayIncome: '—',
    monthIncome: '—',
    totalOrders: 0,
    rating: '—',
    msgUnread: 0,
    orders: [],
    filteredOrders: [],
    loadError: false
  },

  onShow() {
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
        this._applyProfile()
        this.loadOrders()
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

  _applyProfile() {
    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.role === 'mentor' && profile.mentorStatus === 'approved') {
      this.setData({
        teacherName: profile.name || '银龄导师',
        teacherTitle: (profile.title || '导师') + (profile.subject ? ' · ' + profile.subject : '')
      })
    }
  },

  loadOrders() {
    wx.cloud.callFunction({
      name: 'getOrders',
      data: { scope: 'all' },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          const list = res.result.data.map(item => {
            let typeClass = 'chip'
            if (item.typeText === '磨课坊') typeClass = 'chip-accent'
            else if (item.typeText === '诊课室') typeClass = 'chip-info'
            return Object.assign({}, item, { typeClass, time: this._fmt(item.createTime) })
          })
          this.setData({
            orders: list,
            totalOrders: list.filter(item => item.status === 1 || item.status === 2).length,
            loadError: false
          }, () => { this.filterData() })
        } else {
          this._showLoadError()
        }
      },
      fail: () => { this._showLoadError() }
    })
  },

  _showLoadError() {
    this.setData({
      orders: [],
      totalOrders: 0,
      loadError: true
    }, () => { this.filterData() })
    wx.showToast({ title: '订单加载失败，请下拉重试', icon: 'none' })
  },

  switchTab(e) {
    this.setData({ currentTab: parseInt(e.currentTarget.dataset.index) }, () => { this.filterData() })
  },

  filterData() {
    const { orders, currentTab } = this.data
    this.setData({ filteredOrders: orders.filter(item => item.status === currentTab) })
  },

  grabOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认接单',
      content: '接单后进入指导阶段。请确认自己有时间完成指导；演示版不提供自动服务时限保障。',
      confirmColor: '#2D5683',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '接单中...' })
        wx.cloud.callFunction({
          name: 'grabOrder',
          data: { orderId: id },
          success: (cloudRes) => {
            wx.hideLoading()
            if (cloudRes.result && cloudRes.result.code === 0) {
              this.loadOrders()
              wx.showToast({ title: '接单成功', icon: 'success' })
            } else {
              wx.showToast({ title: (cloudRes.result && cloudRes.result.error) || '接单失败', icon: 'none' })
            }
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '接单失败，请重试', icon: 'none' })
          }
        })
      }
    })
  },

  openReply(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orders.find(o => o._id === id)
    if (!order) return
    const detail = order.detail || {}
    const fileID = detail.fileID || ''
    const fileName = detail.fileName || detail.videoName || ''
    wx.navigateTo({
      url: '/pages/teacher-reply/teacher-reply?id=' + id +
        '&title=' + encodeURIComponent(order.title) +
        '&type=' + encodeURIComponent(order.typeText) +
        '&student=' + encodeURIComponent(order.student || '') +
        '&desc=' + encodeURIComponent(order.desc || '') +
        '&price=' + (order.price || 0) +
        '&fileID=' + encodeURIComponent(fileID) +
        '&fileName=' + encodeURIComponent(fileName)
    })
  },

  goToWithdraw() { wx.navigateTo({ url: '/pages/teacher-mine/teacher-mine' }) },

  navMsg() { wx.redirectTo({ url: '/pages/teacher-msg/teacher-msg' }) },
  navMine() { wx.redirectTo({ url: '/pages/teacher-mine/teacher-mine' }) },
  navHome() { /* 已在工作台 */ },

  onPullDownRefresh() {
    this.loadOrders()
    wx.stopPullDownRefresh()
  },

  _fmt(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚发布'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
  }
})
