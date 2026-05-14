Page({
  data: {
    currentTab: 0,
    orders: [],
    filteredOrders: [],
    loading: false
  },

  onShow() {
    this.loadOrders()
  },

  loadOrders() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'getOrders',
      success: res => {
        const list = (res.result && res.result.data) ? res.result.data : []
        const decorated = list.map(item => {
          let typeClass = 'chip'
          if (item.typeText === '磨课坊') typeClass = 'chip-accent'
          else if (item.typeText === '诊课室') typeClass = 'chip-info'
          return Object.assign({}, item, { typeClass })
        })
        this.setData({ orders: decorated, loading: false }, () => { this.filterData() })
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '同步失败', icon: 'none' })
      }
    })
  },

  filterData() {
    const { orders, currentTab } = this.data
    let filtered = orders
    if (currentTab === 1) filtered = orders.filter(item => item.status === 1)
    else if (currentTab === 2) filtered = orders.filter(item => item.status === 2)
    this.setData({ filteredOrders: filtered })
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({ currentTab: index }, () => { this.filterData() })
  },

  // 进入对话
  openChat(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orders.find(o => o._id === id)
    if (!order) return
    const convId = 'order_' + id
    wx.navigateTo({
      url: '/pages/chat/chat?conversationId=' + convId +
        '&name=' + encodeURIComponent(order.teacher || '名师') +
        '&char=' + encodeURIComponent((order.teacher || '师')[0]) +
        '&theme=badge-primary'
    })
  },

  remindOrder() {
    wx.showToast({ title: '已发送催办提醒', icon: 'success' })
  },

  goToCreate() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onPullDownRefresh() {
    this.loadOrders()
    wx.stopPullDownRefresh()
  }
})
