Page({
  data: {
    course: null,
    loading: true
  },

  onLoad(options) {
    const id = options.id || 'course_default'
    wx.cloud.callFunction({
      name: 'getContents',
      data: { id: id },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data.length > 0) {
          this.setData({ course: res.result.data[0], loading: false })
        } else {
          this.setData({ loading: false })
        }
      },
      fail: () => { this.setData({ loading: false }) }
    })
  },

  startLearn() {
    wx.showToast({ title: '已加入学习计划', icon: 'success' })
  }
})
