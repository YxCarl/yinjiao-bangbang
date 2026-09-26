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

    this.loadMessages()
    this._startPolling()

    recorderManager.onStop((res) => {
      this.setData({ recording: false })
      if (res.duration < 1000) return wx.showToast({ title: '录音时间太短', icon: 'none' })
      const dur = Math.round(res.duration / 1000)
      this._prepareVoiceUpload(res.tempFilePath, dur)
    })
    recorderManager.onError(() => {
      this.setData({ recording: false })
      wx.showToast({ title: '录音失败', icon: 'none' })
    })
  },

  loadMessages() {
    if (!this.data.conversationId || this._messagesLoadPending) return
    this._messagesLoadPending = true
    const requestSeq = (this._messagesRequestSeq || 0) + 1
    this._messagesRequestSeq = requestSeq
    wx.cloud.callFunction({
      name: 'getMessages',
      data: { conversationId: this.data.conversationId },
      success: (res) => {
        this._messagesLoadPending = false
        if (requestSeq === this._messagesRequestSeq && res.result && res.result.code === 0 && Array.isArray(res.result.data)) {
          this.setData({ messages: res.result.data.map(m => ({
            id: m._id, side: m.side, kind: m.kind || 'text',
            text: m.content || '', fileID: m.fileID || '', dur: m.dur || 0
          }))})
        }
      },
      fail: () => { this._messagesLoadPending = false }
    })
  },

  switchMethod(e) { this.setData({ replyMethod: e.currentTarget.dataset.method }) },
  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendMsg() {
    if (this._sendingText || !this.data.conversationId) return
    const text = this.data.inputText.trim()
    if (!text) return
    this._sendingText = true
    this._sendToCloud('text', text)
  },

  _prepareVoiceUpload(tempPath, dur) {
    if (!this.data.conversationId) return
    const preview = '语音 ' + dur + ' 秒'
    const requestId = createRequestId('message')
    wx.showLoading({ title: '准备语音上传...', mask: true })
    wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        action: 'prepare_voice',
        conversationId: this.data.conversationId,
        requestId: requestId
      },
      success: (prepareRes) => {
        const result = prepareRes.result || {}
        const cloudPath = result.data && result.data.cloudPath
        if (result.code !== 0 || !cloudPath) {
          wx.hideLoading()
          return wx.showToast({ title: result.error || '无法准备语音上传', icon: 'none' })
        }
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempPath,
          success: (uploadRes) => {
            wx.hideLoading()
            this._sendToCloud('voice', preview, uploadRes.fileID, dur, requestId)
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '语音未发送，请重试', icon: 'none' })
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '无法准备语音上传', icon: 'none' })
      }
    })
  },

  _sendToCloud(kind, content, fileID, dur, existingRequestId) {
    if (!this.data.conversationId) return
    const payload = {
      conversationId: this.data.conversationId,
      requestId: existingRequestId || createRequestId('message'),
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
        if (payload.kind === 'text') this._sendingText = false
        if (result.code === 0) {
          if (payload.kind === 'text' && this.data.inputText.trim() === payload.content) {
            this.setData({ inputText: '' })
          }
          this.loadMessages()
          wx.showToast({ title: '已发送', icon: 'success' })
          return
        }
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
        if (payload.kind === 'text') this._sendingText = false
        wx.showToast({ title: '消息发送失败，请检查网络', icon: 'none' })
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
      this.loadMessages()
    }, 3000)
  },

  onUnload() {
    if (this._pollTimer) clearInterval(this._pollTimer)
  }
})
