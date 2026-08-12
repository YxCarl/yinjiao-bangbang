Page({
  data: {
    role: 'student'
  },

  selectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role })
  },

  goBack() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  doLogin() {
    const requestedRole = this.data.role
    wx.showLoading({ title: '登录中...', mask: true })

    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: requestedRole },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          this._finishLogin(res.result.data, requestedRole)
        } else {
          this._localFallback(requestedRole)
        }
      },
      fail: () => {
        wx.hideLoading()
        this._localFallback(requestedRole)
      }
    })
  },

  _finishLogin(user, requestedRole) {
    const approvedMentor = user.role === 'mentor' && user.mentorStatus === 'approved'
    wx.setStorageSync('myProfile', user)
    wx.setStorageSync('userId', user._id)
    wx.setStorageSync('isLogged', true)
    wx.setStorageSync('userRole', user.role)

    if (requestedRole === 'mentor' && !approvedMentor) {
      wx.showToast({ title: '请先提交导师申请', icon: 'none' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/teacher-cert/teacher-cert' })
      }, 600)
      return
    }

    wx.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      if (approvedMentor) {
        wx.redirectTo({ url: '/pages/teacher/teacher' })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 600)
  },

  _localFallback(requestedRole) {
    const defaultProfile = {
      _id: 'local_' + Date.now(),
      role: 'student',
      mentorStatus: 'not_requested',
      name: '微信用户',
      tag: '教育行业新人',
      avatar: '新',
      balance: '50.00'
    }
    wx.setStorageSync('myProfile', defaultProfile)
    wx.setStorageSync('userId', defaultProfile._id)
    wx.setStorageSync('isLogged', true)
    wx.setStorageSync('userRole', 'student')
    wx.showToast({ title: '当前为离线预览', icon: 'none' })
    setTimeout(() => {
      if (requestedRole === 'mentor') {
        wx.redirectTo({ url: '/pages/teacher-cert/teacher-cert' })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 600)
  }
})
