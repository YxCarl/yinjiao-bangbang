function getURL(kind, referenceId, fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getProtectedFileURL',
      data: {
        kind: kind,
        referenceId: referenceId || '',
        fileID: fileID || ''
      },
      success: (response) => {
        const result = response.result || {}
        if (result.code === 0 && result.data && result.data.url) {
          resolve(result.data.url)
          return
        }
        reject(new Error(result.error || '文件访问失败'))
      },
      fail: (error) => reject(error)
    })
  })
}

function download(kind, referenceId, fileID) {
  return getURL(kind, referenceId, fileID).then(url => new Promise((resolve, reject) => {
    wx.downloadFile({
      url: url,
      success: (result) => {
        if (result.statusCode && result.statusCode >= 400) {
          reject(new Error('文件下载失败'))
          return
        }
        resolve(result)
      },
      fail: (error) => reject(error)
    })
  }))
}

module.exports = {
  download: download,
  getURL: getURL
}
