App({
  onLaunch: function () {
    // 1. 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-1georyfz22e96029',
        traceUser: true
      })
    }

    // 2. 路由拦截：根据登录状态与角色路由
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const isLogged = wx.getStorageSync('isLogged')
    const role = wx.getStorageSync('userRole')

    setTimeout(() => {
      if (!isLogged) {
        // 未登录：直奔登录页
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      // 已登录：根据角色路由
      if (role === 'mentor') {
        wx.redirectTo({ url: '/pages/teacher/teacher' })
      } else {
        // 学员/默认：进入首页 tab
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 100)
  }
})
