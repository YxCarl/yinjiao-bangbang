Page({
  data: {
    msgUnread: 0,
    conversations: [],
    filteredList: [],
    listLimited: false,
    loadError: false
  },

  onShow() {
    const profile = wx.getStorageSync('myProfile') || {}
    if (!(profile.role === 'mentor' && profile.mentorStatus === 'approved')) {
      wx.showToast({ title: '导师身份尚未通过审核', icon: 'none' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/teacher-cert/teacher-cert' })
      }, 600)
      return
    }
    this.setData({ conversations: [], filteredList: [], msgUnread: 0, listLimited: false, loadError: false })
    this._tryCloudSync()
  },

  _getStored() {
    return this.data.conversations
  },

  _render() {
    const list = this._getStored()
    const unreadTotal = list.reduce((sum, c) => sum + (c.unread || 0), 0)
    this.setData({ conversations: list, msgUnread: unreadTotal, filteredList: list })
  },

  _tryCloudSync() {
    wx.cloud.callFunction({
      name: 'getConversations',
      success: (res) => {
        if (!(res.result && res.result.code === 0)) {
          this.setData({ loadError: true })
          wx.showToast({ title: '消息加载失败，请重试', icon: 'none' })
          return
        }
        const conversations = res.result.data.map(c => ({
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
        const msgUnread = conversations.reduce((sum, conversation) => sum + conversation.unread, 0)
        this.setData({
          conversations,
          filteredList: conversations,
          msgUnread,
          listLimited: res.result.scanLimitReached === true,
          loadError: false
        })
      },
      fail: () => {
        this.setData({ loadError: true })
        wx.showToast({ title: '消息加载失败，请重试', icon: 'none' })
      }
    })
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
    const list = this._getStored()
    const item = list.find(c => c.id === id)
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
    const list = this._getStored()
    let changed = false
    list.forEach(c => {
      if (c.id === id && c.unread > 0) { c.unread = 0; changed = true }
    })
    if (!changed) return

    this._render()

    if (!id.startsWith('local_') && id !== 'sys') {
      wx.cloud.callFunction({
        name: 'sendMessage',
        data: { conversationId: list.find(c => c.id === id)?.conversationId || '', kind: '_read', content: '' },
        success: () => {},
        fail: () => {}
      })
    }
  },

  navHome() { wx.redirectTo({ url: '/pages/teacher/teacher' }) },
  navMsg() { /* 已在消息 */ },
  navMine() { wx.redirectTo({ url: '/pages/teacher-mine/teacher-mine' }) }
})
