Page({
  data: {
    videoPath: '',
    videoName: '',
    uploading: false,
    aiStatus: 0,
    aiTimeline: []
  },

  uploadVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sizeType: ['compressed'],
      maxDuration: 900,
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        const name = 'video_' + Date.now() + '.mp4'

        wx.showLoading({ title: '上传视频中...' })
        wx.cloud.uploadFile({
          cloudPath: 'zhenke/' + name,
          filePath: tempPath,
          success: (uploadRes) => {
            wx.hideLoading()
            this.setData({
              videoPath: tempPath,
              videoName: name,
              fileID: uploadRes.fileID,
              aiStatus: 1
            })
            // 模拟 AI 分析
            setTimeout(() => {
              this.setData({
                aiStatus: 2,
                aiTimeline: [
                  { time: '02:15', label: '导入' },
                  { time: '08:40', label: '新授' },
                  { time: '15:20', label: '板书' }
                ]
              })
            }, 2000)
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '视频上传失败', icon: 'none' })
          }
        })
      }
    })
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
          fileID: this.data.fileID
        }
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result.code === -2) {
          return wx.showToast({ title: res.result.msg, icon: 'none', duration: 2000 })
        }
        if (res.result.data && res.result.data.balance !== undefined) {
          wx.setStorageSync('myBalance', res.result.data.balance);
          const p = wx.getStorageSync('myProfile') || {}; p.balance = res.result.data.balance; wx.setStorageSync('myProfile', p)
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
