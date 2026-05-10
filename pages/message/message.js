Page({
  data: {
    conversations: [
      {
        id: 'sys',
        type: 'system',
        char: '通',
        theme: 'badge-info',
        name: '系统通知',
        time: '刚刚',
        preview: '您的订单【诊课室】已被李建国老师接单，请耐心等待诊断报告。',
        unread: 1
      },
      {
        id: 'tutor-1',
        type: 'chat',
        char: '李',
        theme: 'badge-primary',
        name: '李建国 · 特级教师',
        time: '昨天 14:20',
        preview: '[语音] 这部分的板书设计还可以再精简一下，突出重点……',
        unread: 0
      },
      {
        id: 'tutor-2',
        type: 'chat',
        char: '王',
        theme: 'badge-accent',
        name: '王素芬 · 高级教师',
        time: '前天',
        preview: '收到您的教案了，今晚我详细批注后回复你。',
        unread: 2
      }
    ]
  },

  openItem(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.conversations.find(c => c.id === id)
    if (!item) return

    if (item.type === 'system') {
      wx.showModal({
        title: '系统通知',
        content: item.preview,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#2D5683'
      })
      this._markRead(id)
    } else {
      this._markRead(id)
      // 携带参数进入聊天页
      wx.navigateTo({
        url: '/pages/chat/chat?id=' + id + '&name=' + encodeURIComponent(item.name) + '&char=' + encodeURIComponent(item.char) + '&theme=' + item.theme
      })
    }
  },

  _markRead(id) {
    const list = this.data.conversations.map(c => {
      if (c.id === id) c.unread = 0
      return c
    })
    this.setData({ conversations: list })
  }
})
