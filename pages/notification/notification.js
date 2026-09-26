Page({
  data: {
    notifications: [
      {
        id: 'demo-info',
        type: 'system',
        title: '通知功能说明',
        content: '此页面尚未接入真实系统通知。',
        time: '',
        full: '本开源版尚未接入独立的云端通知服务。请在订单和已授权会话中查看实际状态，不要把演示文案当作真实接单通知。'
      }
    ],
    currentId: ''
  },

  onLoad(options) {
    const id = options.id || 'demo-info'
    const item = this.data.notifications.find(n => n.id === id) || this.data.notifications[0]
    this.setData({ currentId: item.id })
    wx.setNavigationBarTitle({ title: item.title })
  }
})
