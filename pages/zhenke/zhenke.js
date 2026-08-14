const {
  beginOrderRequest,
  createRequestId,
  finishOrderRequest
} = require('../../utils/order-request')

const MAX_VIDEO_BYTES = 200 * 1024 * 1024
const MAX_VIDEO_DURATION_SECONDS = 600
const ACTIVE_ANALYSIS_TASK_KEY = 'activeVideoAnalysisTaskId'

Page({
  data: {
    videoPath: '',
    videoName: '',
    fileID: '',
    aiStatus: 0,
    aiTimeline: []
  },

  onLoad() {
    const activeTask = wx.getStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
    const taskId = typeof activeTask === 'string'
      ? activeTask
      : activeTask && activeTask.taskId
    if (taskId) {
      this.setData({
        aiStatus: 1,
        fileID: activeTask.fileID || '',
        videoName: activeTask.videoName || ''
      })
      wx.showLoading({ title: '恢复分析进度...', mask: true })
      this._beginPolling(taskId)
    }
  },

  onUnload() {
    this._analysisPollRun = (this._analysisPollRun || 0) + 1
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
      maxDuration: MAX_VIDEO_DURATION_SECONDS,
      success: (res) => {
        wx.hideLoading()
        const file = res.tempFiles[0]
        const name = 'video_' + Date.now() + '.mp4'
        this._prepareVideoUpload(file.tempFilePath, name, file.size, file.duration)
      },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.indexOf('cancel') > -1) return
        // iOS 兼容：chooseMedia 失败降级为 chooseVideo
        wx.chooseVideo({
          maxDuration: MAX_VIDEO_DURATION_SECONDS,
          success: (res) => {
            const name = 'video_' + Date.now() + '.mp4'
            this._prepareVideoUpload(res.tempFilePath, name, res.size, res.duration)
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

  _prepareVideoUpload(tempPath, name, fileSize, durationSeconds) {
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize >= MAX_VIDEO_BYTES) {
      return wx.showToast({ title: '视频大小必须小于 200MB', icon: 'none', duration: 2500 })
    }
    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 ||
      durationSeconds > MAX_VIDEO_DURATION_SECONDS
    ) {
      return wx.showToast({ title: '视频时长必须在 10 分钟以内', icon: 'none', duration: 2500 })
    }

    const requestId = createRequestId('video')
    wx.showLoading({ title: '创建安全上传任务...', mask: true })
    wx.cloud.callFunction({
      name: 'analyzeVideo',
      data: {
        action: 'prepare',
        requestId: requestId,
        fileName: name,
        fileSize: fileSize,
        durationSeconds: durationSeconds
      },
      success: (res) => {
        const result = res.result || {}
        const task = result.data || {}
        if (result.code !== 0 || !task.taskId || !task.cloudPath) {
          wx.hideLoading()
          this.setData({ aiStatus: 0 })
          return wx.showModal({
            title: '无法创建分析任务',
            content: result.error || '请稍后重试',
            showCancel: false,
            confirmText: '知道了'
          })
        }
        this._uploadToCloud(tempPath, name, task.cloudPath, task.taskId)
      },
      fail: (error) => {
        wx.hideLoading()
        this.setData({ aiStatus: 0 })
        wx.showToast({ title: error.errMsg || '创建上传任务失败', icon: 'none' })
      }
    })
  },

  _uploadToCloud(tempPath, name, cloudPath, taskId) {
    wx.showLoading({ title: '上传视频中...' })
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempPath,
      success: (uploadRes) => {
        wx.hideLoading()
        this.setData({
          videoPath: tempPath, videoName: name, fileID: uploadRes.fileID
        })
        this._startAnalyze(taskId, uploadRes.fileID)
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({ title: '视频上传失败：' + (err.errMsg || '请重试'), icon: 'none', duration: 3000 })
      }
    })
  },

  _startAnalyze(taskId, fileID) {
    wx.showLoading({ title: 'AI 分析中...', mask: true })
    this.setData({ aiStatus: 1 })
    wx.setStorageSync(ACTIVE_ANALYSIS_TASK_KEY, {
      taskId: taskId,
      fileID: fileID,
      videoName: this.data.videoName
    })
    wx.cloud.callFunction({
      name: 'analyzeVideo',
      data: { action: 'start', taskId: taskId, fileID: fileID },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data) {
          const { taskId, timeline } = res.result.data
          if (timeline && timeline.length) {
            wx.hideLoading()
            wx.removeStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
            this.setData({ aiStatus: 2, aiTimeline: timeline })
          } else if (taskId) {
            wx.showLoading({ title: 'AI 分析中...', mask: true })
            this._beginPolling(taskId)
          } else {
            wx.hideLoading()
            wx.removeStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
            this.setData({ aiStatus: 0 })
            wx.showToast({ title: '分析启动失败', icon: 'none' })
          }
        } else {
          wx.hideLoading()
          wx.removeStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
          const errMsg = (res.result && res.result.error) ? res.result.error : '分析失败'
          this.setData({ aiStatus: 0 })
          wx.showModal({ title: 'AI 分析失败', content: errMsg, showCancel: false, confirmText: '知道了' })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ aiStatus: 1 })
        wx.showToast({ title: '连接中断，正在查询任务状态', icon: 'none' })
        this._beginPolling(taskId)
      }
    })
  },

  _beginPolling(taskId) {
    const runId = (this._analysisPollRun || 0) + 1
    this._analysisPollRun = runId
    const activeTask = wx.getStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
    const activeTaskId = typeof activeTask === 'string'
      ? activeTask
      : activeTask && activeTask.taskId
    if (activeTaskId !== taskId) {
      wx.setStorageSync(ACTIVE_ANALYSIS_TASK_KEY, { taskId: taskId })
    }
    this._pollResult(taskId, 0, runId)
  },

  _pollResult(taskId, count, runId) {
    if (runId !== this._analysisPollRun) return
    if (count > 100) {
      wx.hideLoading()
      this.setData({ aiStatus: 1 })
      wx.showModal({
        title: '分析仍在后台进行',
        content: '任务已安全保留。稍后重新进入诊课室页面即可继续查询，无需重复上传。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    setTimeout(() => {
      wx.cloud.callFunction({
        name: 'analyzeVideo',
        data: { action: 'status', taskId: taskId },
        success: (res) => {
          if (res.result && res.result.code === 0 && res.result.data) {
            const d = res.result.data
            if (d.status === 'done') {
              wx.hideLoading()
              wx.removeStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
              this._analysisPollRun += 1
              this.setData({ aiStatus: 2, aiTimeline: d.timeline || [] })
            } else if (d.status === 'error') {
              wx.hideLoading()
              wx.removeStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
              this._analysisPollRun += 1
              this.setData({ aiStatus: 0 })
              wx.showModal({ title: 'AI 分析失败', content: d.error || '未知错误', showCancel: false, confirmText: '知道了' })
            } else {
              wx.showLoading({ title: 'AI 分析中(' + (count + 1) + ')...', mask: true })
              this._pollResult(taskId, count + 1, runId)
            }
          } else if (res.result && res.result.code === -3) {
            wx.hideLoading()
            wx.removeStorageSync(ACTIVE_ANALYSIS_TASK_KEY)
            this._analysisPollRun += 1
            this.setData({ aiStatus: 0 })
            wx.showModal({ title: '无法恢复任务', content: res.result.error || '任务不可访问', showCancel: false })
          } else {
            this._pollResult(taskId, count + 1, runId)
          }
        },
        fail: () => { this._pollResult(taskId, count + 1, runId) }
      })
    }, 3000)
  },

  submitZhenke() {
    if (!this.data.fileID) return wx.showToast({ title: '请先上传视频', icon: 'none' })

    const order = {
      typeText: '诊课室',
      title: '试讲视频 逐帧诊断',
      price: 128,
      detail: {
        videoName: this.data.videoName,
        fileID: this.data.fileID,
        aiTimeline: this.data.aiTimeline
      }
    }
    const requestId = beginOrderRequest(this, order)
    if (!requestId) return

    wx.showLoading({ title: '正在提交订单...' })
    wx.cloud.callFunction({
      name: 'addOrder',
      data: Object.assign({ requestId: requestId }, order),
      success: (res) => {
        wx.hideLoading()
        finishOrderRequest(this, true)
        const result = res.result || {}
        if (result.code !== 0) {
          return wx.showToast({
            title: result.error || '提交失败，请重试',
            icon: 'none',
            duration: 2000
          })
        }
        if (result.data && result.data.balance !== undefined) {
          const p = wx.getStorageSync('myProfile')
          if (p) { p.balance = result.data.balance; wx.setStorageSync('myProfile', p) }
        }
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => { wx.switchTab({ url: '/pages/order/order' }) }, 1500)
      },
      fail: () => {
        wx.hideLoading()
        finishOrderRequest(this, false)
        wx.showToast({ title: '提交失败，请检查网络', icon: 'none' })
      }
    })
  }
})
