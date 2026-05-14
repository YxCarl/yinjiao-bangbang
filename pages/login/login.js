Page({
  data: {
    role: 'student'
  },

  selectRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ role })
  },

  goBack() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  doLogin() {
    const role = this.data.role
    wx.showLoading({ title: '登录中...', mask: true })

    wx.cloud.callFunction({
      name: 'loginOrFetch',
      data: { role: role },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const user = res.result.data
          wx.setStorageSync('myProfile', user)
          wx.setStorageSync('userId', user._id)
          wx.setStorageSync('isLogged', true)
          wx.setStorageSync('userRole', role)
          wx.showToast({ title: '登录成功', icon: 'success' })

          setTimeout(() => {
            if (role === 'mentor') {
              wx.redirectTo({ url: '/pages/teacher/teacher' })
            } else {
              wx.switchTab({ url: '/pages/index/index' })
            }
          }, 600)
        } else {
          this._localFallback(role)
        }
      },
      fail: () => {
        wx.hideLoading()
        this._localFallback(role)
      }
    })
  },

  _localFallback(role) {
    const defaultProfile = {
      _id: 'local_' + Date.now(),
      role: role,
      name: role === 'mentor' ? '银龄教师' : '微信用户',
      tag: role === 'mentor' ? '退休/在岗资深教师' : '教育行业新人',
      avatar: role === 'mentor' ? '师' : '新',
      title: role === 'mentor' ? '资深教师' : '',
      subject: role === 'mentor' ? '待完善' : '',
      years: '0',
      rating: '5.0',
      balance: role === 'mentor' ? '0.00' : '50.00'
    }
    wx.setStorageSync('myProfile', defaultProfile)
    wx.setStorageSync('userId', defaultProfile._id)
    wx.setStorageSync('isLogged', true)
    wx.setStorageSync('userRole', role)
    wx.showToast({ title: '已离线登录', icon: 'none' })
    setTimeout(() => {
      if (role === 'mentor') {
        wx.redirectTo({ url: '/pages/teacher/teacher' })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 600)
  }
})
