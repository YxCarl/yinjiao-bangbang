Page({
  data: {
    notifications: [
      {
        id: 'sys',
        type: 'system',
        title: '订单接单通知',
        content: '您的订单【诊课室】已被李建国老师接单，请耐心等待诊断报告。老师将在 24 小时内开始提供服务。',
        time: '刚刚',
        full: '李建国老师（特级教师 · 中学语文）已接取您的诊课室订单。老师将仔细观看您的试讲视频，并从教态、语言表达、板书设计、课堂互动等多个维度给出逐帧点评和优化建议。请耐心等待老师完成诊断报告，预计 1-3 个工作日内交付。'
      }
    ],
    currentId: ''
  },

  onLoad(options) {
    const id = options.id || 'sys'
    const item = this.data.notifications.find(n => n.id === id) || this.data.notifications[0]
    this.setData({ currentId: id })
    wx.setNavigationBarTitle({ title: item.title })
  }
})
