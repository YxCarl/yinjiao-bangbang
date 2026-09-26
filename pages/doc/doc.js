const protectedFile = require('../../utils/protected-file')

Page({
  data: {
    doc: null,
    loading: true
  },

  onLoad(options) {
    const id = options.id || 'doc_default'
    wx.cloud.callFunction({
      name: 'getContents',
      data: { id: id },
      success: (res) => {
        if (res.result && res.result.code === 0 && res.result.data.length > 0) {
          this.setData({ doc: res.result.data[0], loading: false })
        } else {
          this.setData({ loading: false })
        }
      },
      fail: () => { this.setData({ loading: false }) }
    })
  },

  saveDoc() { wx.showToast({ title: '演示版未接入收藏', icon: 'none' }) },

  downloadDoc() {
    const doc = this.data.doc
    if (!doc || !doc.fileID) {
      wx.showToast({ title: '暂无下载文件', icon: 'none' })
      return
    }
    wx.showLoading({ title: '下载中...' })
    protectedFile.download('content', doc._id)
      .then((result) => {
        wx.hideLoading()
        wx.openDocument({
          filePath: result.tempFilePath,
          success: () => {},
          fail: () => { wx.showToast({ title: '请在小程序外打开', icon: 'none' }) }
        })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '下载失败', icon: 'none' })
      })
  }
})
