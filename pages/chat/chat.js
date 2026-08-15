const recorderManager = wx.getRecorderManager()
const protectedFile = require('../../utils/protected-file')
const { createRequestId } = require('../../utils/order-request')

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
    userRole: 'student',
    myAvatar: '我'
  },

  onLoad(options) {
    if (options.name) this.setData({ peerName: decodeURIComponent(options.name) })
    if (options.char) this.setData({ peerChar: decodeURIComponent(options.char) })
    if (options.theme) this.setData({ peerTheme: options.theme })
    if (options.conversationId) this.setData({ conversationId: options.conversationId })
    wx.setNavigationBarTitle({ title: this.data.peerName })

    const profile = wx.getStorageSync('myProfile')
    if (profile && profile.role) {
      this.setData({
        userRole: profile.role,
        myAvatar: profile.avatar || (profile.name ? profile.name[0] : '我')
      })
    }

    this._sentTexts = []
    this.loadMessages()
    this._ensureConversation()
    this._startPolling()

    recorderManager.onStop((res) => {
      this.setData({ recording: false })
      if (res.duration < 1000) return wx.showToast({ title: '录音时间太短', icon: 'none' })
      const dur = Math.round(res.duration / 1000)
      const preview = '语音 ' + dur + ' 秒'
      const list = this.data.messages.slice()
      list.push({ id: Date.now(), side: 'out', kind: 'voice', dur: dur, text: preview, fileID: '' })
      this.setData({ messages: list })
      this._sentTexts.push(preview)
      this._updateCache(preview)
      wx.cloud.uploadFile({
        cloudPath: 'chat/' + Date.now() + '.mp3',
        filePath: res.tempFilePath,
        success: (uploadRes) => {
          const msgs = this.data.messages.slice()
          msgs.forEach(m => { if (m.text === preview && !m.fileID) m.fileID = uploadRes.fileID })
          this.setData({ messages: msgs })
          this._sendToCloud('voice', preview, uploadRes.fileID, dur)
        },
        fail: () => { wx.showToast({ title: '语音上传失败，消息已保留', icon: 'none' }) }
      })
    })
    recorderManager.onError(() => {
      this.setData({ recording: false })
      wx.showToast({ title: '录音失败', icon: 'none' })
    })
  },

  _ensureConversation() {
    if (!this.data.conversationId) return
    const storageKey = this.data.userRole === 'mentor' ? 'teacherConvData' : 'studentConvData'
    const cache = wx.getStorageSync(storageKey) || []
    const exists = cache.find(c => c.conversationId === this.data.conversationId)
    if (!exists) {
      const newConv = {
        id: Date.now().toString(), conversationId: this.data.conversationId,
        type: 'chat', char: this.data.peerChar, theme: this.data.peerTheme,
        name: this.data.peerName, desc: '', time: '刚刚', preview: '开始对话', unread: 0
      }
      cache.unshift(newConv)
      wx.setStorageSync(storageKey, cache)
    }
  },

  loadMessages() {
    if (!this.data.conversationId) return
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
    this._sentTexts.push(text)
    this._updateCache(text)
    this._sendToCloud('text', text)
  },

  _sendToCloud(kind, content, fileID, dur) {
    if (!this.data.conversationId) return
    const payload = {
      conversationId: this.data.conversationId,
      requestId: createRequestId('message'),
      kind: kind,
      content: content,
      fileID: fileID || '',
      dur: dur || 0
    }
    this._callSendMessage(payload, 0)
  },

  _callSendMessage(payload, retryCount) {
    wx.cloud.callFunction({
      name: 'sendMessage',
      data: payload,
      success: (res) => {
        const result = res.result || {}
        if (result.code === 0) return
        wx.showToast({
          title: result.error || '消息发送失败',
          icon: 'none',
          duration: 2500
        })
      },
      fail: () => {
        if (retryCount < 1) {
          setTimeout(() => this._callSendMessage(payload, retryCount + 1), 800)
          return
        }
        wx.showToast({ title: '消息发送失败，请检查网络', icon: 'none' })
      }
    })
  },

  _updateCache(preview) {
    ['teacherConvData', 'studentConvData'].forEach(key => {
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
    protectedFile.download('message', this.data.conversationId, fileID)
      .then((result) => {
        const audio = wx.createInnerAudioContext()
        audio.src = result.tempFilePath; audio.play()
        audio.onEnded(() => { audio.destroy() })
        audio.onError(() => { audio.destroy() })
      })
      .catch(() => { wx.showToast({ title: '播放失败', icon: 'none' }) })
  },

  _pollTimer: null,

  _startPolling() {
    this._pollTimer = setInterval(() => {
      if (!this.data.conversationId) return
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { conversationId: this.data.conversationId },
        success: (res) => {
          if (res.result && res.result.code === 0 && res.result.data) {
            const currentIds = this.data.messages.map(m => m.id)
            const newMsgs = res.result.data.filter(m => {
              if (currentIds.includes(m._id)) return false
              if (this._sentTexts && this._sentTexts.includes(m.content)) return false
              return true
            })
            if (newMsgs.length > 0) {
              const all = this.data.messages.concat(newMsgs.map(m => ({
                id: m._id, side: m.side, kind: m.kind || 'text',
                text: m.content || '', fileID: m.fileID || '', dur: m.dur || 0
              })))
              this.setData({ messages: all })
            }
          }
        },
        fail: () => {}
      })
    }, 3000)
  },

  onUnload() {
    if (this._pollTimer) clearInterval(this._pollTimer)
  }
})
