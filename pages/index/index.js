Page({
  data: {
    userName: '同学',
    orderCount: 0,
    completedCount: 0,
    progress: 0,
    banners: [
      { tag: '本周热门', title: '考编面试 · 名师真题逐帧拆解', sub: '李建国 特级教师 主讲' },
      { tag: '新手专享', title: '首次发单立减 ¥10', sub: '凡进入磨课坊订单自动抵扣' }
    ],
    bannerIndex: 0,
    tutors: [
      { id: 1, char: '李', subject: '中学语文 · 特级教师', name: '李老师', tag: '考编评委', desc: '考编面试主考官 · 专治试讲不自信', rating: '4.9', orders: '328', theme: 'badge-primary' },
      { id: 2, char: '王', subject: '小学数学 · 高级教师', name: '王老师', tag: '30年教龄', desc: '精准把控教姿教态与板书设计', rating: '4.8', orders: '256', theme: 'badge-accent' },
      { id: 3, char: '张', subject: '高中物理 · 正高级', name: '张老师', tag: '学科带头人', desc: '深入浅出，攻克重难点教学设计', rating: '4.9', orders: '189', theme: 'badge-info' }
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
