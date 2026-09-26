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
    wx.showModal({
      title: '演示课程',
      content: '当前仅提供目录示例，尚未接入真实课程视频或学习计划。',
      showCancel: false
    })
  }
})
