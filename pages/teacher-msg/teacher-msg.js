Page({
  data: {
    msgUnread: 0,
    conversations: [],
    filteredList: [],
    fallbackConversations: [
      {
        id: 'tutor-1', conversationId: 'conv_demo_t1', type: 'chat',
        char: '周', theme: 'badge-primary', name: '周同学',
        desc: '小学语文《桂林山水》教案精修', time: '刚刚',
        preview: '老师好，我已经把修改后的教案发过来了，麻烦您再看看。', unread: 1
      },
      {
        id: 'tutor-2', conversationId: 'conv_demo_t2', type: 'chat',
        char: '林', theme: 'badge-accent', name: '林老师',
        desc: '试讲视频诊断（15分钟）', time: '10分钟前',
        preview: '谢谢您的点评！关于教态方面我还有一些疑问想请教。', unread: 2
      },
      {
        id: 'tutor-3', conversationId: 'conv_demo_t3', type: 'chat',
        char: '张', theme: 'badge-info', name: '张同学',
        desc: '初中数学《勾股定理》说课稿把关', time: '昨天 14:00',
        preview: '好的，我明白了。感谢您的建议！', unread: 0
      }
    ]
  },

  onShow() {
    this.loadConversations()
  },

  loadConversations() {
    wx.cloud.callFunction({
      name: 'getConversations',
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data.length > 0) {
          const list = res.result.data.map(c => ({
            id: c._id,
            conversationId: c.conversationId,
            type: 'chat',
            char: c.peerName ? c.peerName[0] : '学',
            theme: c.peerTheme || 'badge-primary',
            name: c.peerName || '学员',
            desc: c.orderTitle || '',
            time: this._formatTime(c.lastTime),
            preview: c.lastMsg || '',
            unread: c.unread || 0
          }))
          const unreadTotal = list.reduce((sum, c) => sum + c.unread, 0)
          this.setData({ conversations: list, msgUnread: unreadTotal, filteredList: list })
        } else {
          this._useFallback()
        }
      },
      fail: () => { this._useFallback() }
    })
  },

  _useFallback() {
    const list = this.data.fallbackConversations
    const unreadTotal = list.reduce((sum, c) => sum + c.unread, 0)
    this.setData({ conversations: list, msgUnread: unreadTotal, filteredList: list })
  },

  _formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    return (d.getMonth() + 1) + '-' + d.getDate()
  },

  openChat(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.conversations.find(c => c.id === id)
    if (!item) return

    this._markRead(id)
    const convId = item.conversationId || id
    wx.navigateTo({
      url: '/pages/chat/chat?conversationId=' + convId +
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
