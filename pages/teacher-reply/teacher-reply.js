const recorderManager = wx.getRecorderManager()

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
    replies: [],
    showRating: false
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

    this._sentTexts = []
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
    wx.cloud.callFunction({
      name: 'getMessages',
      data: { conversationId: this.data.conversationId },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data.length > 0) {
          this.setData({ replies: res.result.data.map(m => ({
            side: m.side, kind: m.kind || 'text',
            text: m.content || '', fileID: m.fileID || '', dur: m.dur || 0, time: ''
          }))})
        }
      },
      fail: () => {}
    })
  },

  switchMethod(e) { this.setData({ replyMethod: e.currentTarget.dataset.method }) },
  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendText() {
    const text = this.data.inputText.trim()
    if (!text) return wx.showToast({ title: '请输入回复内容', icon: 'none' })
    const list = this.data.replies.slice()
    list.push({ side: 'out', kind: 'text', text, time: '刚刚' })
    this.setData({ replies: list, inputText: '' })
    this._sentTexts.push(text)
    this._sendToCloud('text', text)
    wx.showToast({ title: '已发送', icon: 'success' })
  },

  _sendToCloud(kind, content, fileID, dur) {
    wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        conversationId: this.data.conversationId,
        kind: kind,
        content: content,
        fileID: fileID || '',
        dur: dur || 0
      },
      success: () => {}, fail: () => {}
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
    const preview = '语音 ' + dur + '"'
    const list = this.data.replies.slice()
    list.push({ side: 'out', kind: 'voice', dur: dur, text: preview, fileID: '', time: '刚刚' })
    this.setData({ replies: list })
    this._sentTexts.push(preview)
    wx.showLoading({ title: '上传语音...' })
    wx.cloud.uploadFile({
      cloudPath: 'voice/' + Date.now() + '.mp3',
      filePath: tempPath,
      success: (res) => {
        wx.hideLoading()
        const msgs = this.data.replies.slice()
        msgs.forEach(m => { if (m.text === preview && !m.fileID) m.fileID = res.fileID })
        this.setData({ replies: msgs })
        this._sendToCloud('voice', preview, res.fileID, dur)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '语音上传失败，消息已保留', icon: 'none' })
      }
    })
  },

  playVoice(e) {
    const fileID = e.currentTarget.dataset.fileid
    if (!fileID) return wx.showToast({ title: '语音文件不存在', icon: 'none' })
    wx.cloud.downloadFile({
      fileID: fileID,
      success: (res) => {
        const audio = wx.createInnerAudioContext()
        audio.src = res.tempFilePath; audio.play()
        audio.onEnded(() => { audio.destroy() })
        audio.onError(() => { audio.destroy() })
      },
      fail: () => { wx.showToast({ title: '加载语音失败', icon: 'none' }) }
    })
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
                this.setData({ showRating: true })
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

  submitRating(e) {
    const rating = e.currentTarget.dataset.rating
    this.setData({ showRating: false })
    wx.showToast({ title: '已评分 ★' + rating, icon: 'none' })
  },

  downloadFile() {
    if (!this.data.fileID) return wx.showToast({ title: '无附件', icon: 'none' })
    wx.showLoading({ title: '下载中...' })
    wx.cloud.getTempFileURL({
      fileList: [this.data.fileID],
      success: (res) => {
        if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
          wx.downloadFile({
            url: res.fileList[0].tempFileURL,
            success: (dlRes) => {
              wx.hideLoading()
              wx.openDocument({
                filePath: dlRes.tempFilePath,
                showMenu: true,
                success: () => {},
                fail: () => { wx.showToast({ title: '请在聊天中打开', icon: 'none' }) }
              })
            },
            fail: (err) => { wx.hideLoading(); wx.showToast({ title: '下载失败: ' + (err.errMsg || ''), icon: 'none' }) }
          })
        } else {
          wx.hideLoading()
          wx.showToast({ title: '文件链接获取失败', icon: 'none' })
        }
      },
      fail: (err) => { wx.hideLoading(); wx.showToast({ title: '文件访问失败: ' + (err.errMsg || ''), icon: 'none' }) }
    })
  },

  goBack() { wx.navigateBack() },

  _pollTimer: null,

  _startPolling() {
    this._pollTimer = setInterval(() => {
      if (!this.data.conversationId) return
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { conversationId: this.data.conversationId },
        success: (res) => {
          if (res.result && res.result.code === 0 && res.result.data) {
            const newMsgs = res.result.data.filter(m => {
              if (this._sentTexts && this._sentTexts.includes(m.content)) return false
              const alreadyExists = this.data.replies.some(r => r.text === m.content)
              return !alreadyExists
            })
            if (newMsgs.length > 0) {
              const all = this.data.replies.concat(newMsgs.map(m => ({
                side: m.side, kind: m.kind || 'text',
                text: m.content || '', fileID: m.fileID || '', dur: m.dur || 0, time: ''
              })))
              this.setData({ replies: all })
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
