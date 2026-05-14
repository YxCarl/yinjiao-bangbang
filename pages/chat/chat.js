const recorderManager = wx.getRecorderManager()

Page({
  data: {
    conversationId: '',
    peerName: '名师',
    peerChar: '师',
    peerTheme: 'badge-primary',
    inputText: '',
    replyMethod: 'text',
    recording: false,
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

    recorderManager.onStop((res) => {
      this.setData({ recording: false })
      if (res.duration < 1000) return wx.showToast({ title: '录音时间太短', icon: 'none' })
      const dur = Math.round(res.duration / 1000)
      const preview = '语音 ' + dur + '"'
      wx.cloud.uploadFile({
        cloudPath: 'chat/' + Date.now() + '.mp3',
        filePath: res.tempFilePath,
        success: (uploadRes) => {
          const list = this.data.messages.slice()
          list.push({ id: Date.now(), side: 'out', kind: 'voice', dur: dur, text: preview, fileID: uploadRes.fileID })
          this.setData({ messages: list })
          this._syncConvCache(preview)
          if (this.data.conversationId) {
            wx.cloud.callFunction({
              name: 'sendMessage', data: { conversationId: this.data.conversationId, kind: 'voice', content: preview },
              success: () => {}, fail: () => {}
            })
          }
        },
        fail: () => { wx.showToast({ title: '上传失败', icon: 'none' }) }
      })
    })

    recorderManager.onError(() => {
      this.setData({ recording: false })
      wx.showToast({ title: '录音失败', icon: 'none' })
    })
  },

  loadMessages() {
    if (!this.data.conversationId) {
      this.setData({
        messages: [{ id: 1, side: 'in', kind: 'text', text: '欢迎开始对话，您的每条消息都将被记录。', createTime: '' }]
      })
      return
    }
    wx.cloud.callFunction({
      name: 'getMessages',
      data: { conversationId: this.data.conversationId },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data.length > 0) {
          this.setData({ messages: res.result.data.map(m => ({
            id: m._id, side: m.side, kind: m.kind || 'text',
            text: m.content || '', fileID: m.fileID || '', dur: m.dur || 0
          }))})
        }
      },
      fail: () => {}
    })
  },

  switchMethod(e) { this.setData({ replyMethod: e.currentTarget.dataset.method }) },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendMsg() {
    const text = this.data.inputText.trim()
    if (!text) return
    const list = this.data.messages.slice()
    list.push({ id: Date.now(), side: 'out', kind: 'text', text })
    this.setData({ messages: list, inputText: '' })
    this._syncConvCache(text)

    if (this.data.conversationId) {
      wx.cloud.callFunction({
        name: 'sendMessage', data: { conversationId: this.data.conversationId, kind: 'text', content: text },
        success: () => {}, fail: () => {}
      })
    }
  },

  _syncConvCache(preview) {
    const keys = ['teacherConvData', 'studentConvData']
    keys.forEach(key => {
      const cache = wx.getStorageSync(key)
      if (cache && cache.length) {
        wx.setStorageSync(key, cache.map(c => {
          if (c.conversationId === this.data.conversationId) { c.preview = preview; c.time = '刚刚' }
          return c
        }))
      }
    })
  },

  startRecord() {
    this.setData({ recording: true })
    recorderManager.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })
  },

  stopRecord() {
    if (this.data.recording) recorderManager.stop()
  },

  playVoice(e) {
    const fileID = e.currentTarget.dataset.fileid
    if (!fileID) return
    wx.cloud.downloadFile({
      fileID: fileID,
      success: (res) => {
        const audio = wx.createInnerAudioContext()
        audio.src = res.tempFilePath; audio.play()
        audio.onEnded(() => { audio.destroy() })
        audio.onError(() => { audio.destroy() })
      },
      fail: () => { wx.showToast({ title: '播放失败', icon: 'none' }) }
    })
  }
})
