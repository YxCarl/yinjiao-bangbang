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
        // 给每个订单补上展示需要的 typeClass
        const decorated = list.map(item => {
          let typeClass = 'chip'
          if (item.typeText === '磨课坊') typeClass = 'chip-accent'
          else if (item.typeText === '诊课室') typeClass = 'chip-info'
          else if (item.typeText === '问诊室') typeClass = 'chip'
          return Object.assign({}, item, { typeClass })
        })
        this.setData({ orders: decorated, loading: false }, () => {
          this.filterData()
        })
      },
      fail: err => {
        this.setData({ loading: false })
        wx.showToast({ title: '同步失败', icon: 'none' })
        console.error('云端数据拉取异常', err)
      }
    })
  },

  filterData() {
    const { orders, currentTab } = this.data
    let filtered = []
    if (currentTab === 0) {
      filtered = orders
    } else {
      filtered = orders.filter(item => item.status === currentTab)
    }
    this.setData({ filteredOrders: filtered })
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({ currentTab: index }, () => {
      this.filterData()
    })
  },

  remindOrder() {
    wx.showToast({ title: '已发送催办提醒', icon: 'success' })
  },

  viewReport() {
    wx.showToast({ title: '指导报告生成中', icon: 'none' })
  },

  goToCreate() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onPullDownRefresh() {
    this.loadOrders()
    wx.stopPullDownRefresh()
  }
})
