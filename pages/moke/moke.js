const { beginOrderRequest, finishOrderRequest } = require('../../utils/order-request')

Page({
  data: {
    hasFile: false,
    fileName: '',
    filePath: '',
    fileSize: 0,
    grades: ['早教', '小学', '初中', '高中'],
    subjectsMap: {
      '早教': [],
      '小学': ['语文', '数学', '英语'],
      '初中': ['语文', '数学', '英语'],
      '高中': ['语文', '数学', '英语']
    },
    selectedGrade: '',
    selectedSubject: '',
    currentSubjects: [],
    teacherLevels: ['高级教师', '特级教师', '有评委经历(优先)'],
    selectedLevel: '',
    priceAmount: ''
  },

  onGradeChange(e) {
    const grade = this.data.grades[e.detail.value]
    const subjects = this.data.subjectsMap[grade] || []
    this.setData({ selectedGrade: grade, selectedSubject: '', currentSubjects: subjects })
  },

  onSubjectChange(e) {
    this.setData({ selectedSubject: this.data.currentSubjects[e.detail.value] })
  },

  onLevelChange(e) {
    this.setData({ selectedLevel: this.data.teacherLevels[e.detail.value] })
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['doc', 'docx', 'pdf'],
      success: (res) => {
        const file = res.tempFiles[0]
        if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 50 * 1024 * 1024) {
          return wx.showToast({ title: '文件无效或超过50MB，请重新选择', icon: 'none' })
        }
        this.setData({
          hasFile: true,
          fileName: file.name,
          filePath: file.path,
          fileSize: file.size
        })
        wx.showToast({ title: '已选择文件', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) wx.showToast({ title: '选择文件失败', icon: 'none' })
      }
    })
  },

  onPriceInput(e) { this.setData({ priceAmount: e.detail.value }) },

  submitOrder() {
    if (!this.data.hasFile) return wx.showToast({ title: '请先上传教案文档', icon: 'none' })
    if (!this.data.selectedGrade) return wx.showToast({ title: '请选择学段', icon: 'none' })
    if (this.data.selectedGrade !== '早教' && !this.data.selectedSubject) return wx.showToast({ title: '请选择学科', icon: 'none' })
    if (!this.data.selectedLevel) return wx.showToast({ title: '请选择期望教师等级', icon: 'none' })

    const finalPrice = Number(this.data.priceAmount)
    if (!Number.isFinite(finalPrice) || finalPrice < 49) {
      return wx.showToast({ title: '模拟悬赏额度最低 49 学币', icon: 'none', duration: 2000 })
    }

    const requestId = beginOrderRequest(this, {
      typeText: '磨课坊',
      title: this.data.selectedGrade + (this.data.selectedSubject || '') + ' 教案精修',
      price: finalPrice,
      grade: this.data.selectedGrade,
      subject: this.data.selectedSubject,
      level: this.data.selectedLevel,
      fileName: this.data.fileName,
      filePath: this.data.filePath,
      fileSize: this.data.fileSize
    })
    if (!requestId) return

    wx.showLoading({ title: '正在准备上传...' })
    wx.cloud.callFunction({
      name: 'addOrder',
      data: {
        action: 'prepare_document',
        requestId: requestId,
        fileName: this.data.fileName,
        fileSize: this.data.fileSize
      },
      success: (prepareRes) => {
        const prepared = prepareRes.result || {}
        if (prepared.code !== 0 || !prepared.data || !prepared.data.cloudPath) {
          wx.hideLoading()
          finishOrderRequest(this, true)
          return wx.showToast({
            title: prepared.error || '准备上传失败，请重试',
            icon: 'none'
          })
        }

        wx.showLoading({ title: '正在上传文件...' })
        wx.cloud.uploadFile({
          cloudPath: prepared.data.cloudPath,
          filePath: this.data.filePath,
          success: (uploadRes) => {
            wx.showLoading({ title: '正在提交订单...' })
            wx.cloud.callFunction({
              name: 'addOrder',
              data: {
                requestId: requestId,
                typeText: '磨课坊',
                title: this.data.selectedGrade + (this.data.selectedSubject || '') + ' 教案精修',
                price: finalPrice,
                detail: {
                  grade: this.data.selectedGrade,
                  subject: this.data.selectedSubject,
                  level: this.data.selectedLevel,
                  fileName: this.data.fileName,
                  fileSize: this.data.fileSize,
                  fileID: uploadRes.fileID
                }
              },
              success: (res) => {
                wx.hideLoading()
                finishOrderRequest(this, true)
                const result = res.result || {}
                if (result.code !== 0) {
                  return wx.showToast({
                    title: result.error || '派单失败，请重试',
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
                wx.showToast({ title: '派单失败，请检查网络', icon: 'none' })
              }
            })
          },
          fail: () => {
            wx.hideLoading()
            finishOrderRequest(this, false)
            wx.showToast({ title: '文件上传失败，请重试', icon: 'none' })
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        finishOrderRequest(this, false)
        wx.showToast({ title: '准备上传失败，请检查网络', icon: 'none' })
      }
    })
  }
})
