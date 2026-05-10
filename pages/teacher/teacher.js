Page({
  data: {
    currentTab: 0,
    teacherName: '李老师',
    teacherTitle: '特级教师 · 中学语文',
    todayIncome: '320.00',
    monthIncome: '1,280.00',
    totalOrders: 328,
    rating: '4.9',
    msgUnread: 3,
    orders: [
      { id: 1, status: 0, typeClass: 'chip-accent', typeText: '磨课坊', time: '刚刚发布', title: '小学语文《桂林山水》教案精修', desc: '需要针对导入和板书设计给出批注。', price: 89, student: '周同学' },
      { id: 2, status: 0, typeClass: 'chip-info', typeText: '诊课室', time: '10分钟前', title: '试讲视频诊断（15分钟）', desc: '希望对教态、语言表达逐帧点评。', price: 128, student: '林老师' },
      { id: 3, status: 1, typeClass: 'chip-accent', typeText: '磨课坊', time: '昨天 14:00', title: '初中数学《勾股定理》说课稿把关', desc: '梳理说课逻辑。', price: 59, student: '张同学' },
      { id: 4, status: 2, typeClass: 'chip', typeText: '问诊室', time: '3天前', title: '入职新教师 家校沟通困惑', desc: '已完成语音回复 45 秒。', price: 29, student: '王老师' }
    ],
    filteredOrders: []
  },

  onShow() {
    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.role === 'mentor') {
      this.setData({
        teacherName: profile.name || '银龄导师',
        teacherTitle: (profile.title || '资深教师') + (profile.subject ? ' · ' + profile.subject : '')
      })
    }
    this.filterData()
  },

  switchTab(e) {
    this.setData({ currentTab: parseInt(e.currentTarget.dataset.index) })
    this.filterData()
  },

  filterData() {
    const filtered = this.data.orders.filter(item => item.status === this.data.currentTab)
    this.setData({ filteredOrders: filtered })
  },

  grabOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认接单',
      content: '接单后将进入指导阶段，需在 24 小时内开始服务。',
      confirmColor: '#2D5683',
      success: (res) => {
        if (res.confirm) {
          const newOrders = this.data.orders.map(order => {
            if (order.id === id) order.status = 1
            return order
          })
          this.setData({ orders: newOrders })
          this.filterData()
          wx.showToast({ title: '接单成功', icon: 'success' })
        }
      }
    })
  },

  // 进入回复窗口
  openReply(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orders.find(o => o.id === id)
    if (!order) return
    wx.navigateTo({
      url: '/pages/teacher-reply/teacher-reply?id=' + id +
           '&title=' + encodeURIComponent(order.title) +
           '&type=' + encodeURIComponent(order.typeText) +
           '&student=' + encodeURIComponent(order.student) +
           '&desc=' + encodeURIComponent(order.desc) +
           '&price=' + order.price
    })
  },

  goToWithdraw() {
    wx.navigateTo({ url: '/pages/teacher-mine/teacher-mine' })
  },

  // 底部导航
  navMsg() { wx.redirectTo({ url: '/pages/teacher-msg/teacher-msg' }) },
  navMine() { wx.redirectTo({ url: '/pages/teacher-mine/teacher-mine' }) },
  navHome() { /* 已在工作台 */ },

  onPullDownRefresh() {
    if (this.data.currentTab !== 0) {
      wx.stopPullDownRefresh()
      return
    }
    setTimeout(() => {
      const newOrder = {
        id: Date.now(), status: 0, typeClass: 'chip', typeText: '问诊室',
        time: '刚刚', title: '新课标大单元教学设计困惑',
        desc: '希望能结合真实案例解答。', price: 29, student: '匿名学员'
      }
      this.setData({ orders: [newOrder, ...this.data.orders] })
      this.filterData()
      wx.stopPullDownRefresh()
      wx.showToast({ title: '发现新订单', icon: 'none' })
    }, 800)
  }
})
