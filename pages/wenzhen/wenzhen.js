Page({
  data: { questionText: '', isAnonymous: true },

  onInput(e) { this.setData({ questionText: e.detail.value }) },
  onAnonymousChange(e) { this.setData({ isAnonymous: e.detail.value }) },

  submitQuestion() {
    if (this.data.questionText.length < 10) {
      return wx.showToast({ title: '请至少描述10个字', icon: 'none' })
    }

    wx.showLoading({ title: '正在提交云端...' })
    wx.cloud.callFunction({
      name: 'addOrder',
      data: {
        typeText: '问诊室',
        title: (this.data.isAnonymous ? '【匿名】' : '') + '教育职场咨询',
        price: 29,
        detail: { content: this.data.questionText }
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.code === -2) {
          return wx.showToast({ title: res.result.msg, icon: 'none', duration: 2000 })
        }
        if (res.result.data && res.result.data.balance !== undefined) {
          wx.setStorageSync('myBalance', res.result.data.balance);
        const p = wx.getStorageSync('myProfile') || {}; p.balance = res.result.data.balance; wx.setStorageSync('myProfile', p)
        }
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => { wx.switchTab({ url: '/pages/order/order' }) }, 1500)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '提交失败，请检查网络', icon: 'none' })
      }
    })
  }
})
