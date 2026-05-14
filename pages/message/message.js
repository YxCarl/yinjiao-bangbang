const STORAGE_KEY = 'studentConvData'
const db = wx.cloud.database()

Page({
  data: {
    conversations: []
  },

  fallbackData: [
    {
      id: 'sys', type: 'system',
      char: '通', theme: 'badge-info',
      name: '系统通知', time: '刚刚',
      preview: '您的订单【诊课室】已被李建国老师接单，请耐心等待诊断报告。',
      unread: 1
    },
    {
      id: 'tutor-1', conversationId: 'conv_demo_1', type: 'chat',
      char: '李', theme: 'badge-primary',
      name: '李建国 · 特级教师', time: '昨天 14:20',
      preview: '这部分的板书设计还可以再精简一下，突出重点……',
      unread: 0
    },
    {
      id: 'tutor-2', conversationId: 'conv_demo_2', type: 'chat',
      char: '王', theme: 'badge-accent',
      name: '王素芬 · 高级教师', time: '前天',
      preview: '收到您的教案了，今晚我详细批注后回复你。',
      unread: 2
    }
  ],

  onShow() {
    this._render()
    this._tryCloudSync()
  },

  _getStored() {
    let data = wx.getStorageSync(STORAGE_KEY)
    if (data && data.length) return data
    data = this.fallbackData.map(c => ({ ...c }))
    wx.setStorageSync(STORAGE_KEY, data)
    return data
  },

  _render() {
    this.setData({ conversations: this._getStored() })
  },

  _tryCloudSync() {
    wx.cloud.callFunction({
      name: 'getConversations',
      success: (res) => {
        if (!(res.result && res.result.code === 0 && res.result.data.length > 0)) return
        const stored = this._getStored()
        const storedMap = {}
        stored.forEach(s => { storedMap[s.conversationId || s.id] = s })

        const merged = res.result.data.map(c => {
          const existing = storedMap[c.conversationId]
          return {
            id: c._id,
            conversationId: c.conversationId,
            type: 'chat',
            char: c.peerName ? c.peerName[0] : '学',
            theme: c.peerTheme || 'badge-primary',
            name: c.peerName || '学员',
            time: this._formatTime(c.lastTime) || (existing ? existing.time : ''),
            preview: c.lastMsg || (existing ? existing.preview : ''),
            unread: existing ? existing.unread : (c.unread || 0)
          }
        })

        wx.setStorageSync(STORAGE_KEY, merged)
        this._render()
      },
      fail: () => {}
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

    wx.setStorageSync(STORAGE_KEY, list)
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
