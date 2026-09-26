Page({
  data: {
    conversations: [],
    listLimited: false,
    loadError: false
  },

  onShow() {
    this.setData({ conversations: [], listLimited: false, loadError: false })
    this._tryCloudSync()
  },

  _getStored() {
    return this.data.conversations
  },

  _render() {
    this.setData({ conversations: this._getStored() })
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
            time: this._formatTime(c.lastTime),
            preview: c.lastMsg || '',
            unread: c.unread || 0
        }))
        this.setData({ conversations, listLimited: res.result.scanLimitReached === true, loadError: false })
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

  openItem(e) {
    const id = e.currentTarget.dataset.id
    const list = this._getStored()
    const item = list.find(c => c.id === id)
    if (!item) return

    if (item.type === 'system') {
      this._markRead(id)
      wx.navigateTo({ url: '/pages/notification/notification?id=' + id })
    } else {
      this._markRead(id)
      const convId = item.conversationId || id
      wx.navigateTo({
        url: '/pages/chat/chat?conversationId=' + convId +
          '&name=' + encodeURIComponent(item.name) +
          '&char=' + encodeURIComponent(item.char) +
          '&theme=' + item.theme
      })
    }
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
      const item = list.find(c => c.id === id)
      if (item) {
        const convId = item.conversationId || id
        wx.cloud.callFunction({
          name: 'sendMessage',
          data: { conversationId: convId, kind: '_read', content: '' },
          success: () => {},
          fail: () => {}
        })
      }
    }
  }
})
