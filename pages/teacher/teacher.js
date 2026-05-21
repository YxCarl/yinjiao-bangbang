const db = wx.cloud.database()

Page({
  data: {
    currentTab: 0,
    teacherName: '李老师',
    teacherTitle: '特级教师 · 中学语文',
    todayIncome: '320.00',
    monthIncome: '1,280.00',
    totalOrders: 0,
    rating: '4.9',
    msgUnread: 0,
    orders: [],
    filteredOrders: []
  },

  onShow() {
    const role = wx.getStorageSync('userRole')
    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: role || 'mentor' },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          wx.setStorageSync('myProfile', res.result.data)
          wx.setStorageSync('userId', res.result.data._id)
        }
        this._applyProfile()
      },
      fail: () => { this._applyProfile() }
    })
    this.loadOrders()
  },

  _applyProfile() {
    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.role === 'mentor') {
      this.setData({
        teacherName: profile.name || '银龄导师',
        teacherTitle: (profile.title || '资深教师') + (profile.subject ? ' · ' + profile.subject : '')
      })
    }
  },

  loadOrders() {
    wx.cloud.callFunction({
      name: 'getOrders',
      data: { scope: 'all', role: 'mentor' },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          const list = res.result.data.map(item => {
            let typeClass = 'chip'
            if (item.typeText === '磨课坊') typeClass = 'chip-accent'
            else if (item.typeText === '诊课室') typeClass = 'chip-info'
            return Object.assign({}, item, { typeClass, time: this._fmt(item.createTime) })
          })
          this.setData({ orders: list, totalOrders: list.length }, () => { this.filterData() })
        } else {
          this._useFallbackOrders()
        }
      },
      fail: () => { this._useFallbackOrders() }
    })
  },

  _useFallbackOrders() {
    this.setData({
      orders: [
        { _id: 'fb1', status: 0, typeClass: 'chip-accent', typeText: '磨课坊', title: '暂无订单，请学生端发布任务', desc: '任务发布后将在此处显示', price: 0, student: '' },
        { _id: 'fb2', status: 1, typeClass: 'chip-info', typeText: '诊课室', title: '暂无进行中的订单', desc: '接单后订单将出现在此处', price: 0, student: '' }
      ],
      totalOrders: 2
    }, () => { this.filterData() })
  },

  switchTab(e) {
    this.setData({ currentTab: parseInt(e.currentTarget.dataset.index) }, () => { this.filterData() })
  },

  filterData() {
    const { orders, currentTab } = this.data
    this.setData({ filteredOrders: currentTab === 0 ? orders : orders.filter(item => item.status === currentTab) })
  },

  grabOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认接单',
      content: '接单后将进入指导阶段，需在 24 小时内开始服务。',
      confirmColor: '#2D5683',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '接单中...' })
        const profile = wx.getStorageSync('myProfile') || {}
        const teacherName = profile.name || '导师'
        const teacherAvatar = profile.avatar || (teacherName[0] || '师')
        const teacherId = wx.getStorageSync('userId') || ''
        db.collection('orders').doc(id).update({
          data: { status: 1, teacher: teacherName, teacherId: teacherId, teacherAvatar: teacherAvatar },
          success: () => {
            wx.hideLoading()
            this._localGrab(id, teacherName)
          },
          fail: () => {
            wx.hideLoading()
            this._localGrab(id, teacherName)
          }
        })
      }
    })
  },

  _localGrab(id, teacherName) {
    const newOrders = this.data.orders.map(order => {
      if (order._id === id) { order.status = 1; order.teacher = teacherName }
      return order
    })
    this.setData({ orders: newOrders }, () => { this.filterData() })
    wx.showToast({ title: '接单成功', icon: 'success' })
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
    if (this.data.currentTab !== 0) { wx.stopPullDownRefresh(); return }
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
