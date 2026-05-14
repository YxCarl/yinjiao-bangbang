const recorderManager = wx.getRecorderManager()
const db = wx.cloud.database()

Page({
  data: {
    orderId: '',
    orderTitle: '',
    orderType: '',
    studentName: '',
    orderDesc: '',
    orderPrice: 0,
    inputText: '',
    replyMethod: 'text',
    recording: false,
    replies: [
      {
        side: 'in', kind: 'text',
        text: '老师好，教案我已经按您上次的建议修改了，导入部分加了情境，您看看还有哪里需要调整？',
        time: '昨天 16:30'
      }
    ],
    showRating: false
  },

  onLoad(options) {
    this.setData({
      orderId: options.id || '',
      orderTitle: decodeURIComponent(options.title || ''),
      orderType: decodeURIComponent(options.type || ''),
      studentName: decodeURIComponent(options.student || ''),
      orderDesc: decodeURIComponent(options.desc || ''),
      orderPrice: parseFloat(options.price) || 0
    })
    wx.setNavigationBarTitle({ title: this.data.orderType + ' · 回复' })

    recorderManager.onStop((res) => {
      this.setData({ recording: false })
      if (res.duration < 1000) {
        return wx.showToast({ title: '录音时间太短', icon: 'none' })
      }
      this._uploadVoice(res.tempFilePath, Math.round(res.duration / 1000))
    })

    recorderManager.onError(() => {
      this.setData({ recording: false })
      wx.showToast({ title: '录音失败，请重试', icon: 'none' })
    })
  },

  switchMethod(e) {
    this.setData({ replyMethod: e.currentTarget.dataset.method })
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendText() {
    const text = this.data.inputText.trim()
    if (!text) return wx.showToast({ title: '请输入回复内容', icon: 'none' })
    const list = this.data.replies.slice()
    list.push({ side: 'out', kind: 'text', text, time: '刚刚' })
    this.setData({ replies: list, inputText: '' })
    wx.showToast({ title: '已发送', icon: 'success' })
  },

  // 语音：按下开始录音
  startRecord() {
    this.setData({ recording: true })
    recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    })
  },

  // 语音：松开结束录音
  stopRecord() {
    if (this.data.recording) {
      recorderManager.stop()
    }
  },

  _uploadVoice(tempPath, dur) {
    wx.showLoading({ title: '上传语音...' })
    wx.cloud.uploadFile({
      cloudPath: 'voice/' + Date.now() + '.mp3',
      filePath: tempPath,
      success: (res) => {
        wx.hideLoading()
        const list = this.data.replies.slice()
        list.push({
          side: 'out', kind: 'voice', dur: dur,
          text: '语音 ' + dur + '"', fileID: res.fileID, time: '刚刚'
        })
        this.setData({ replies: list })
        wx.showToast({ title: '已发送', icon: 'success' })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    })
  },

  // 播放语音
  playVoice(e) {
    const fileID = e.currentTarget.dataset.fileid
    if (!fileID) return wx.showToast({ title: '语音文件不存在', icon: 'none' })
    wx.showLoading({ title: '加载中...' })
    wx.cloud.downloadFile({
      fileID: fileID,
      success: (res) => {
        wx.hideLoading()
        const audio = wx.createInnerAudioContext()
        audio.src = res.tempFilePath
        audio.play()
        audio.onEnded(() => { audio.destroy() })
        audio.onError(() => {
          wx.showToast({ title: '播放失败', icon: 'none' })
          audio.destroy()
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '加载语音失败', icon: 'none' })
      }
    })
  },

  finishOrder() {
    wx.showModal({
      title: '确认完成',
      content: '确认本次指导已完成？完成后订单将归档至"已完成"列表。',
      confirmColor: '#2D5683',
      success: (res) => {
        if (res.confirm) {
          db.collection('orders').doc(this.data.orderId).update({
            data: { status: 2 },
            success: () => {},
            fail: () => {}
          })
          this.setData({ showRating: true })
          wx.showToast({ title: '已标记完成', icon: 'success' })
        }
      }
    })
  },

  submitRating(e) {
    const rating = e.currentTarget.dataset.rating
    this.setData({ showRating: false })
    wx.showToast({ title: '已评分 ★' + rating, icon: 'none' })
  },

  goBack() { wx.navigateBack() }
})
