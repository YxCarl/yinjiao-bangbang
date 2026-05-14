App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-1georyfz22e96029',
        traceUser: true
      })
    }
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const isLogged = wx.getStorageSync('isLogged')
    const role = wx.getStorageSync('userRole')

    setTimeout(() => {
      if (!isLogged) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      wx.cloud.callFunction({
        name: 'loginOrFetch',
        data: { role: role || 'student' },
        success: (res) => {
          if (res.result && res.result.code === 0) {
            const user = res.result.data
            wx.setStorageSync('myProfile', user)
            wx.setStorageSync('userId', user._id)
            wx.setStorageSync('userRole', user.role || role)
          }
          this._navigateByRole(role)
        },
        fail: () => {
          this._navigateByRole(role)
        }
      })
    }, 100)
  },

  _navigateByRole(role) {
    if (role === 'mentor') {
      wx.redirectTo({ url: '/pages/teacher/teacher' })
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  }
})
