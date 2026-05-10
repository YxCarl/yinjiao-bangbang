Page({
  data: {
    videoPath: '',
    videoName: '',
    aiStatus: 0,
    aiTimeline: []
  },

  uploadVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      success: (res) => {
        this.setData({
          videoPath: res.tempFiles[0].tempFilePath,
          videoName: '教学实录_' + Date.now() + '.mp4',
          aiStatus: 1
        });
        setTimeout(() => {
          this.setData({
            aiStatus: 2,
            aiTimeline: [{time:'02:15',label:'导入'},{time:'08:40',label:'新授'},{time:'15:20',label:'板书'}]
          });
        }, 2000);
      }
    });
  },

  submitZhenke() {
    if (!this.data.videoPath) return wx.showToast({ title: '请先上传视频', icon: 'none' });
    
    wx.showLoading({ title: '正在提交云端...' });
    wx.cloud.callFunction({
      name: 'addOrder',
      data: {
        typeText: '诊课室',
        title: '试讲视频 逐帧诊断',
        price: 128,
        detail: { videoName: this.data.videoName }
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => { wx.switchTab({ url: '/pages/order/order' }); }, 1500);
      }
    });
  }
})