const { beginOrderRequest, finishOrderRequest } = require('../../utils/order-request')

Page({
  data: { questionText: '', isAnonymous: true },

  onInput(e) { this.setData({ questionText: e.detail.value }) },
  onAnonymousChange(e) { this.setData({ isAnonymous: e.detail.value }) },

  submitQuestion() {
    if (this.data.questionText.length < 10) {
      return wx.showToast({ title: '请至少描述10个字', icon: 'none' })
    }

    const order = {
      typeText: '问诊室',
      title: '教育职场咨询',
      anonymous: this.data.isAnonymous,
      price: 29,
      detail: { content: this.data.questionText }
    }
    const requestId = beginOrderRequest(this, order)
    if (!requestId) return

    wx.showLoading({ title: '正在提交云端...' })
    wx.cloud.callFunction({
      name: 'addOrder',
      data: Object.assign({ requestId: requestId }, order),
      success: (res) => {
        wx.hideLoading()
        finishOrderRequest(this, true)
        const result = res.result || {}
        if (result.code !== 0) {
          return wx.showToast({
            title: result.error || '提交失败，请重试',
            icon: 'none',
            duration: 2000
          })
        }
        if (result.data && result.data.balance !== undefined) {
          const p = wx.getStorageSync('myProfile')
          if (p) { p.balance = result.data.balance; wx.setStorageSync('myProfile', p) }
        }
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => { wx.switchTab({ url: '/pages/order/order' }) }, 1500)
      },
      fail: () => {
        wx.hideLoading()
        finishOrderRequest(this, false)
        wx.showToast({ title: '提交失败，请检查网络', icon: 'none' })
      }
    })
  }
})
