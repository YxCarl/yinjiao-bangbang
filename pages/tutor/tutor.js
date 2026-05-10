Page({
  data: {
    tutor: {
      char: '李',
      theme: 'badge-primary',
      name: '李建国',
      title: '中学语文 · 特级教师',
      tags: ['考编评委', '30年教龄', '名师工作室'],
      orderCount: 328,
      rating: 4.9,
      desc: '连续5年担任市级教师编制面试主考官。专注解决试讲紧张、教姿教态不自然、板书逻辑混乱等实战痛点。在我这里，只讲评委爱听的，不讲没用的套话。',
      services: [
        { tag: '磨', theme: 'badge-accent', name: '磨课坊 · 教案精修', price: 89, desc: '一次教案逐句批注 + 改进建议' },
        { tag: '诊', theme: 'badge-info',   name: '诊课室 · 视频逐帧诊断', price: 128, desc: '15 分钟视频教态分析 + 改进方案' }
      ],
      reviews: [
        { name: '周同学', tag: '考编上岸', text: '面试逐字稿被李老师反复修改了 4 版，最后笔面综合排名第一。' },
        { name: '林老师', tag: '入职 1 年', text: '板书设计的逻辑层次终于理顺了，学生反馈也好了很多。' }
      ]
    }
  },

  chatTutor() {
    wx.navigateTo({
      url: '/pages/chat/chat?id=tutor&name=' + encodeURIComponent(this.data.tutor.name) + '&char=' + encodeURIComponent(this.data.tutor.char) + '&theme=' + this.data.tutor.theme
    })
  },
  bookTutor() {
    wx.showLoading({ title: '正在锁定导师...' })
    setTimeout(() => {
      wx.hideLoading()
      wx.navigateTo({ url: '/pages/moke/moke' })
    }, 600)
  },
  collectTutor() {
    wx.showToast({ title: '已收藏', icon: 'success' })
  }
})
