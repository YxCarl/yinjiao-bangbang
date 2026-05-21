Page({
  data: {
    videoPath: '',
    videoName: '',
    fileID: '',
    aiStatus: 0,
    aiTimeline: []
  },

  uploadVideo() {
    // 先检查权限
    wx.getSetting({
      success: (setting) => {
        if (setting.authSetting['scope.camera'] === false || setting.authSetting['scope.album'] === false) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册以选择视频。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting()
            }
          })
          return
        }
        this._doChooseVideo()
      },
      fail: () => {
        // getSetting 失败直接尝试选择
        this._doChooseVideo()
      }
    })
  },

  _doChooseVideo() {
    wx.showLoading({ title: '打开相册...' })
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: 900,
      success: (res) => {
        wx.hideLoading()
        const file = res.tempFiles[0]
        const name = 'video_' + Date.now() + '.mp4'
        this._uploadToCloud(file.tempFilePath, name)
      },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.indexOf('cancel') > -1) return
        // iOS 兼容：chooseMedia 失败降级为 chooseVideo
        wx.chooseVideo({
          maxDuration: 900,
          success: (res) => {
            const name = 'video_' + Date.now() + '.mp4'
            this._uploadToCloud(res.tempFilePath, name)
          },
          fail: (e) => {
            if (e.errMsg && e.errMsg.indexOf('cancel') > -1) return
            wx.showModal({
              title: '无法选择视频',
              content: '请检查微信的相册和摄像头权限是否已开启。\n\n错误：' + (err.errMsg || e.errMsg || '未知'),
              showCancel: false,
              confirmText: '知道了'
            })
          }
        })
      }
    })
  },

  _uploadToCloud(tempPath, name) {
    wx.showLoading({ title: '上传视频中...' })
    wx.cloud.uploadFile({
      cloudPath: 'zhenke/' + name,
      filePath: tempPath,
      success: (uploadRes) => {
        wx.hideLoading()
        this.setData({
          videoPath: tempPath, videoName: name, fileID: uploadRes.fileID
        })
        this._startAnalyze(uploadRes.fileID)
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({ title: '视频上传失败：' + (err.errMsg || '请重试'), icon: 'none', duration: 3000 })
      }
    })
  },

  _startAnalyze(fileID) {
    wx.showLoading({ title: '创建分析任务...', mask: true })
    wx.cloud.callFunction({
      name: 'analyzeVideo',
      data: { fileID: fileID },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data) {
          const { taskId, timeline } = res.result.data
          if (timeline && timeline.length) {
            wx.hideLoading()
            this.setData({ aiStatus: 2, aiTimeline: timeline })
          } else if (taskId) {
            wx.showLoading({ title: 'AI 分析中...', mask: true })
            this._pollResult(taskId, 0)
          } else {
            wx.hideLoading()
            this.setData({ aiStatus: 0 })
            wx.showToast({ title: '分析启动失败', icon: 'none' })
          }
        } else {
          wx.hideLoading()
          const errMsg = (res.result && res.result.error) ? res.result.error : '分析失败'
          this.setData({ aiStatus: 0 })
          wx.showModal({ title: 'AI 分析失败', content: errMsg, showCancel: false, confirmText: '知道了' })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ aiStatus: 0 })
        wx.showModal({ title: '云函数调用失败', content: err.errMsg || err.message || '未知', showCancel: false, confirmText: '知道了' })
      }
    })
  },

  _pollResult(taskId, count) {
    if (count > 30) {
      wx.hideLoading()
      this.setData({ aiStatus: 0 })
      wx.showToast({ title: '分析超时，请重试', icon: 'none' })
      return
    }
    setTimeout(() => {
      wx.cloud.callFunction({
        name: 'analyzeVideo',
        data: { taskId: taskId },
        success: (res) => {
          if (res.result && res.result.code === 0 && res.result.data) {
            const d = res.result.data
            if (d.status === 'done') {
              wx.hideLoading()
              this.setData({ aiStatus: 2, aiTimeline: d.timeline || [] })
            } else if (d.status === 'error') {
              wx.hideLoading()
              this.setData({ aiStatus: 0 })
              wx.showModal({ title: 'AI 分析失败', content: d.error || '未知错误', showCancel: false, confirmText: '知道了' })
            } else {
              wx.showLoading({ title: 'AI 分析中(' + (count + 1) + ')...', mask: true })
              this._pollResult(taskId, count + 1)
            }
          } else {
            this._pollResult(taskId, count + 1)
          }
        },
        fail: () => { this._pollResult(taskId, count + 1) }
      })
    }, 3000)
  },

  submitZhenke() {
    if (!this.data.fileID) return wx.showToast({ title: '请先上传视频', icon: 'none' })

    wx.showLoading({ title: '正在提交订单...' })
    wx.cloud.callFunction({
      name: 'addOrder',
      data: {
        typeText: '诊课室',
        title: '试讲视频 逐帧诊断',
        price: 128,
        detail: {
          videoName: this.data.videoName,
          fileID: this.data.fileID,
          aiTimeline: this.data.aiTimeline
        }
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.code === -2) {
          return wx.showToast({ title: res.result.error, icon: 'none', duration: 2000 })
        }
        if (res.result.data && res.result.data.balance !== undefined) {
          const p = wx.getStorageSync('myProfile')
          if (p) { p.balance = res.result.data.balance; wx.setStorageSync('myProfile', p) }
        }
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => { wx.switchTab({ url: '/pages/order/order' }) }, 1500)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '提交失败，请检查网络', icon: 'none' })
      }
    })
  }
})
