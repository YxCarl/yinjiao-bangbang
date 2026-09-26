Page({
  data: {
    userName: '同学',
    orderCount: 0,
    completedCount: 0,
    progress: 0,
    banners: [
      { tag: '演示内容', title: '教案修改与试讲复盘', sub: '探索学生端与导师端的协作流程' },
      { tag: '开源参考', title: '从需求发布到指导回复', sub: '价格与账户信息均为流程演示' }
    ],
    bannerIndex: 0,
    tutors: [
      { id: 1, char: '示', subject: '示例学科 · 非真实教师', name: '导师卡片示例 A', tag: '演示', desc: '展示导师资料卡片的排版与交互，不代表真实师资。', theme: 'badge-primary' },
      { id: 2, char: '例', subject: '示例学科 · 非真实教师', name: '导师卡片示例 B', tag: '演示', desc: '实际导师身份需要独立审核，不可由客户端选择。', theme: 'badge-accent' }
    ]
  },

  onShow() {
    const role = wx.getStorageSync('userRole')
    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: role || 'student' },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          wx.setStorageSync('myProfile', res.result.data)
          wx.setStorageSync('userId', res.result.data._id)
        }
        this._applyProfile()
      },
      fail: () => { this._applyProfile() }
    })
    this.loadStats()
  },

  _applyProfile() {
    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.name) {
      this.setData({ userName: profile.name })
    }
  },

  loadStats() {
    wx.cloud.callFunction({
      name: 'getOrders',
      success: (res) => {
        if (res.result && res.result.code === 0) {
          const orders = res.result.data
          const total = orders.length
          const completed = orders.filter(o => o.status === 2).length
          const progress = total > 0 ? Math.round(completed / total * 100) : 0
          this.setData({ orderCount: total, completedCount: completed, progress: progress })
        }
      },
      fail: () => {}
    })
  },

  goToSearch() { wx.navigateTo({ url: '/pages/search/search' }) },
  goToMessage() { wx.navigateTo({ url: '/pages/message/message' }) },

  startImprove() { wx.navigateTo({ url: '/pages/moke/moke' }) },
  viewReport() { wx.switchTab({ url: '/pages/order/order' }) },

  goToTutor() { wx.navigateTo({ url: '/pages/tutor/tutor' }) },
  goToMoke() { wx.navigateTo({ url: '/pages/moke/moke' }) },
  goToZhenke() { wx.navigateTo({ url: '/pages/zhenke/zhenke' }) },
  goToWenzhen() { wx.switchTab({ url: '/pages/wenzhen/wenzhen' }) },
  goToCourse() { wx.navigateTo({ url: '/pages/course/course?id=course_default' }) },
  goToDoc() { wx.navigateTo({ url: '/pages/doc/doc?id=doc_default' }) },

  onBannerChange(e) {
    this.setData({ bannerIndex: e.detail.current })
  }
})
