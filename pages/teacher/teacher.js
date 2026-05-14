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
      data: { scope: 'all' },
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
        { _id: 'fb1', status: 0, typeClass: 'chip-accent', typeText: '磨课坊', time: '示例', title: '小学语文教案精修', desc: '请先创建真实订单。', price: 89, student: '示例学员' },
        { _id: 'fb2', status: 1, typeClass: 'chip-info', typeText: '诊课室', time: '示例', title: '试讲视频诊断', desc: '接单后可进入回复。', price: 128, student: '示例学员' }
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
        db.collection('orders').doc(id).update({
          data: { status: 1, teacher: teacherName },
          success: () => {
            wx.hideLoading()
            this._localGrab(id, teacherName)
            this._createConversation(id, teacherName)
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

  _createConversation(orderId, teacherName) {
    const profile = wx.getStorageSync('myProfile') || {}
    const convId = 'order_' + orderId
    const convData = {
      conversationId: convId,
      peerName: teacherName,
      peerTheme: 'badge-primary',
      orderId: orderId,
      orderTitle: '',
      lastMsg: '老师已接单，开始指导吧',
      lastTime: new Date(),
      unread: 1
    }
    db.collection('conversations').add({
      data: Object.assign({}, convData, { _openid: '{openid}' }),
      success: () => {},
      fail: () => {}
    })
  },

  openReply(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orders.find(o => o._id === id)
    if (!order) return
    wx.navigateTo({
      url: '/pages/teacher-reply/teacher-reply?id=' + id +
        '&title=' + encodeURIComponent(order.title) +
        '&type=' + encodeURIComponent(order.typeText) +
        '&student=' + encodeURIComponent(order.student || '') +
        '&desc=' + encodeURIComponent(order.desc || '') +
        '&price=' + (order.price || 0)
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
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚发布'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
  }
})
