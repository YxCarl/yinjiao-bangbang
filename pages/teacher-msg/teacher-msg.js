Page({
  data: {
    msgUnread: 3,
    conversations: [
      {
        id: 'tutor-1',
        type: 'chat',
        char: '周',
        theme: 'badge-primary',
        name: '周同学',
        desc: '小学语文《桂林山水》教案精修',
        time: '刚刚',
        preview: '老师好，我已经把修改后的教案发过来了，麻烦您再看看。',
        unread: 1
      },
      {
        id: 'tutor-2',
        type: 'chat',
        char: '林',
        theme: 'badge-accent',
        name: '林老师',
        desc: '试讲视频诊断（15分钟）',
        time: '10分钟前',
        preview: '谢谢您的点评！关于教态方面我还有一些疑问想请教。',
        unread: 2
      },
      {
        id: 'tutor-3',
        type: 'chat',
        char: '张',
        theme: 'badge-info',
        name: '张同学',
        desc: '初中数学《勾股定理》说课稿把关',
        time: '昨天 14:00',
        preview: '[语音] 45"',
        unread: 0
      },
      {
        id: 'tutor-4',
        type: 'chat',
        char: '王',
        theme: 'badge-success',
        name: '王老师',
        desc: '入职新教师 家校沟通困惑',
        time: '3天前',
        preview: '好的，我明白了。感谢您的建议！',
        unread: 0
      }
    ],
    filteredList: []
  },

  onShow() {
    const unreadTotal = this.data.conversations.reduce((sum, c) => sum + c.unread, 0)
    this.setData({ msgUnread: unreadTotal, filteredList: this.data.conversations })
  },

  openChat(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.conversations.find(c => c.id === id)
    if (!item) return

    this._markRead(id)
    wx.navigateTo({
      url: '/pages/chat/chat?id=' + id +
        '&name=' + encodeURIComponent(item.name) +
        '&char=' + encodeURIComponent(item.char) +
        '&theme=' + item.theme
    })
  },

  _markRead(id) {
    const list = this.data.conversations.map(c => {
      if (c.id === id) c.unread = 0
      return c
    })
    const unreadTotal = list.reduce((sum, c) => sum + c.unread, 0)
    this.setData({ conversations: list, msgUnread: unreadTotal, filteredList: list })
  },

  navHome() { wx.redirectTo({ url: '/pages/teacher/teacher' }) },
  navMsg() { /* 已在消息 */ },
  navMine() { wx.redirectTo({ url: '/pages/teacher-mine/teacher-mine' }) }
})
