Page({
  data: {
    orderId: '',
    orderTitle: '',
    orderType: '',
    studentName: '',
    orderDesc: '',
    orderPrice: 0,
    inputText: '',
    replyMethod: 'text', // 'text' | 'voice'
    replies: [
      {
        side: 'in',
        kind: 'text',
        text: '老师好，教案我已经按您上次的建议修改了，导入部分加了情境，您看看还有哪里需要调整？',
        time: '昨天 16:30'
      }
    ],
    showRating: false
  },

  onLoad(options) {
    this.setData({
      orderId: options.id || '',
      orderTitle: decodeURIComponent(options.title || ''),
      orderType: decodeURIComponent(options.type || ''),
      studentName: decodeURIComponent(options.student || ''),
      orderDesc: decodeURIComponent(options.desc || ''),
      orderPrice: parseFloat(options.price) || 0
    })
    wx.setNavigationBarTitle({ title: this.data.orderType + ' · 回复' })
  },

  switchMethod(e) {
    const method = e.currentTarget.dataset.method
    this.setData({ replyMethod: method })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  sendText() {
    const text = this.data.inputText.trim()
    if (!text) return wx.showToast({ title: '请输入回复内容', icon: 'none' })

    const list = this.data.replies.slice()
    list.push({ side: 'out', kind: 'text', text, time: '刚刚' })
    this.setData({ replies: list, inputText: '' })
    wx.showToast({ title: '已发送', icon: 'success' })
  },

  startVoice() {
    wx.showToast({ title: '长按录音（演示功能）', icon: 'none' })
  },

  finishOrder() {
    wx.showModal({
      title: '确认完成',
      content: '确认本次指导已完成？完成后订单将归档至"已完成"列表。',
      confirmColor: '#2D5683',
      success: (res) => {
        if (res.confirm) {
          this.setData({ showRating: true })
          wx.showToast({ title: '已标记完成', icon: 'success' })
        }
      }
    })
  },

  submitRating(e) {
    const rating = e.currentTarget.dataset.rating
    this.setData({ showRating: false })
    wx.showToast({ title: '已评分 ★' + rating, icon: 'none' })
  },

  goBack() {
    wx.navigateBack()
  }
})
