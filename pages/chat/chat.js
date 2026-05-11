Page({
  data: {
    conversationId: '',
    peerName: '名师',
    peerChar: '师',
    peerTheme: 'badge-primary',
    inputText: '',
    messages: [],
    userRole: 'student'
  },

  onLoad(options) {
    if (options.name) this.setData({ peerName: decodeURIComponent(options.name) })
    if (options.char) this.setData({ peerChar: decodeURIComponent(options.char) })
    if (options.theme) this.setData({ peerTheme: options.theme })
    if (options.conversationId) this.setData({ conversationId: options.conversationId })
    wx.setNavigationBarTitle({ title: this.data.peerName })

    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.role) this.setData({ userRole: profile.role })

    this.loadMessages()
  },

  loadMessages() {
    if (!this.data.conversationId) {
      this.setData({
        messages: [
          { id: 1, side: 'in', kind: 'text', text: '欢迎开始对话，您的每条消息都将被记录。', createTime: '' }
        ]
      })
      return
    }

    wx.cloud.callFunction({
      name: 'getMessages',
      data: { conversationId: this.data.conversationId },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data.length > 0) {
          const msgs = res.result.data.map(m => ({
            id: m._id,
            side: m._openid === '' ? 'in' : 'out',
            kind: m.kind || 'text',
            text: m.content || '',
            createTime: m.createTime || ''
          }))
          this.setData({ messages: msgs })
        }
      },
      fail: () => {}
    })
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendMsg() {
    const text = this.data.inputText.trim()
    if (!text) return
    const list = this.data.messages.slice()
    list.push({ id: Date.now(), side: 'out', kind: 'text', text })
    this.setData({ messages: list, inputText: '' })

    if (this.data.conversationId) {
      wx.cloud.callFunction({
        name: 'sendMessage',
        data: {
          conversationId: this.data.conversationId,
          kind: 'text',
          content: text
        },
        success: () => {},
        fail: () => {}
      })
    }
  },

  playVoice() {
    wx.showToast({ title: '播放语音 (演示)', icon: 'none' })
  }
})
