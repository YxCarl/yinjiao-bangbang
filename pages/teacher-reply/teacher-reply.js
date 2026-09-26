const recorderManager = wx.getRecorderManager()
const protectedFile = require('../../utils/protected-file')
const { createRequestId } = require('../../utils/order-request')

Page({
  data: {
    conversationId: '',
    orderId: '',
    orderTitle: '',
    orderType: '',
    studentName: '',
    orderDesc: '',
    orderPrice: 0,
    fileID: '',
    fileName: '',
    myAvatar: '师',
    inputText: '',
    replyMethod: 'text',
    recording: false,
    replies: []
  },

  onLoad(options) {
    const orderId = options.id || ''
    this.setData({
      conversationId: 'order_' + orderId,
      orderId: orderId,
      orderTitle: decodeURIComponent(options.title || ''),
      orderType: decodeURIComponent(options.type || ''),
      studentName: decodeURIComponent(options.student || ''),
      orderDesc: decodeURIComponent(options.desc || ''),
      orderPrice: parseFloat(options.price) || 0,
      fileID: decodeURIComponent(options.fileID || ''),
      fileName: decodeURIComponent(options.fileName || '')
    })
    wx.setNavigationBarTitle({ title: this.data.orderType + ' · 回复' })

    const profile = wx.getStorageSync('myProfile') || {}
    this.setData({ myAvatar: profile.avatar || (profile.name ? profile.name[0] : '师') })

    this.loadMessages()
    this._startPolling()

    recorderManager.onStop((res) => {
      this.setData({ recording: false })
      if (res.duration < 1000) return wx.showToast({ title: '录音时间太短', icon: 'none' })
      this._uploadVoice(res.tempFilePath, Math.round(res.duration / 1000))
    })
    recorderManager.onError(() => {
      this.setData({ recording: false })
      wx.showToast({ title: '录音失败，请重试', icon: 'none' })
    })
  },

  loadMessages() {
    if (this._messagesLoadPending) return
    this._messagesLoadPending = true
    const requestSeq = (this._messagesRequestSeq || 0) + 1
    this._messagesRequestSeq = requestSeq
    wx.cloud.callFunction({
      name: 'getMessages',
      data: { conversationId: this.data.conversationId },
      success: (res) => {
        this._messagesLoadPending = false
        if (requestSeq === this._messagesRequestSeq && res.result && res.result.code === 0 && Array.isArray(res.result.data)) {
          this.setData({ replies: res.result.data.map(m => ({
            side: m.side, kind: m.kind || 'text',
            text: m.content || '', fileID: m.fileID || '', dur: m.dur || 0, time: ''
          }))})
        }
      },
      fail: () => { this._messagesLoadPending = false }
    })
  },

  switchMethod(e) { this.setData({ replyMethod: e.currentTarget.dataset.method }) },
  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendText() {
    if (this._sendingText) return
    const text = this.data.inputText.trim()
    if (!text) return wx.showToast({ title: '请输入回复内容', icon: 'none' })
    this._sendingText = true
    this._sendToCloud('text', text)
  },

  _sendToCloud(kind, content, fileID, dur, existingRequestId) {
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

  _uploadVoice(tempPath, dur) {
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

  playVoice(e) {
    const fileID = e.currentTarget.dataset.fileid
    if (!fileID) return wx.showToast({ title: '语音文件不存在', icon: 'none' })
    protectedFile.download('message', this.data.conversationId, fileID)
      .then((result) => {
        const audio = wx.createInnerAudioContext()
        audio.src = result.tempFilePath; audio.play()
        audio.onEnded(() => { audio.destroy() })
        audio.onError(() => { audio.destroy() })
      })
      .catch(() => { wx.showToast({ title: '加载语音失败', icon: 'none' }) })
  },

  finishOrder() {
    wx.showModal({
      title: '确认完成',
      content: '确认本次指导已完成？完成后订单将归档至"已完成"列表。',
      confirmColor: '#2D5683',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...' })
          wx.cloud.callFunction({
            name: 'completeOrder',
            data: { orderId: this.data.orderId },
            success: (cloudRes) => {
              wx.hideLoading()
              if (cloudRes.result && cloudRes.result.code === 0) {
                wx.showToast({ title: '已标记完成', icon: 'success' })
              } else {
                wx.showToast({ title: (cloudRes.result && cloudRes.result.error) || '提交失败', icon: 'none' })
              }
            },
            fail: () => {
              wx.hideLoading()
              wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
            }
          })
        }
      }
    })
  },

  downloadFile() {
    if (!this.data.fileID) return wx.showToast({ title: '无附件', icon: 'none' })
    wx.showLoading({ title: '下载中...' })
    protectedFile.download('order', this.data.orderId)
      .then((result) => {
        wx.hideLoading()
        wx.openDocument({
          filePath: result.tempFilePath,
          showMenu: true,
          success: () => {},
          fail: () => { wx.showToast({ title: '请在聊天中打开', icon: 'none' }) }
        })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '文件访问失败', icon: 'none' })
      })
  },

  goBack() { wx.navigateBack() },

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
