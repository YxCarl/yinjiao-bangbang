const db = wx.cloud.database()

Page({
  data: {
    role: 'student' // 默认角色：student=新教师/师范生  mentor=银龄教师
  },

  // 切换身份选择
  selectRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ role })
  },

  // 暂不登录，先去逛逛 (默认以学生身份预览)
  goBack() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 一键登录与注册
  doLogin() {
    const role = this.data.role
    wx.showLoading({ title: '安全登录中...', mask: true })

    // 根据角色生成不同的初始档案
    const baseProfile = {
      role: role, // 关键：角色字段
      id: 'UID' + Date.now().toString().slice(-6),
      createTime: db.serverDate()
    }

    let defaultProfile
    if (role === 'mentor') {
      defaultProfile = Object.assign({}, baseProfile, {
        name: '银龄教师',
        tag: '退休/在岗资深教师',
        avatar: '师',
        title: '资深教师',
        subject: '待完善',
        years: '0',
        rating: '5.0',
        income: '0.00',
        orderCount: 0
      })
    } else {
      defaultProfile = Object.assign({}, baseProfile, {
        name: '微信用户',
        tag: '教育行业新人',
        avatar: '新',
        balance: '50.00'
      })
    }

    db.collection('users').add({
      data: defaultProfile,
      success: (res) => {
        wx.setStorageSync('myProfile', defaultProfile)
        wx.setStorageSync('isLogged', true)
        wx.setStorageSync('userRole', role)

        wx.hideLoading()
        wx.showToast({ title: '登录成功', icon: 'success' })

        setTimeout(() => {
          if (role === 'mentor') {
            // 银龄导师：直达导师工作台
            wx.redirectTo({ url: '/pages/teacher/teacher' })
          } else {
            // 新教师/学员：进首页
            wx.switchTab({ url: '/pages/index/index' })
          }
        }, 800)
      },
      fail: (err) => {
        wx.hideLoading()
        // 即使云端失败也保存本地，方便预览
        wx.setStorageSync('myProfile', defaultProfile)
        wx.setStorageSync('isLogged', true)
        wx.setStorageSync('userRole', role)
        wx.showToast({ title: '已离线登录', icon: 'none' })
        setTimeout(() => {
          if (role === 'mentor') {
            wx.redirectTo({ url: '/pages/teacher/teacher' })
          } else {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }, 800)
      }
    })
  }
})
