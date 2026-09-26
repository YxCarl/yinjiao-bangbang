Page({
  data: {
    tutor: {
      char: '示',
      theme: 'badge-primary',
      name: '导师卡片示例',
      title: '非真实教师 · 界面演示',
      tags: ['演示资料', '待独立审核'],
      orderCount: '—',
      rating: '—',
      desc: '此资料为合成示例，不对应真实教师、资质、指导次数或评价。实际导师须通过独立审核后才能接单。',
      services: [
        { tag: '磨', theme: 'badge-accent', name: '磨课坊 · 教案精修', price: 89, desc: '一次教案逐句批注 + 改进建议' },
        { tag: '诊', theme: 'badge-info',   name: '诊课室 · 视频诊断', price: 128, desc: '演示视频分析流程（最长 10 分钟）' }
      ],
      reviews: []
    }
  },

  chatTutor() {
    wx.showModal({ title: '演示资料', content: '示例导师不能私信。真实会话需由已审核导师接单后创建。', showCancel: false })
  },
  bookTutor() {
    wx.navigateTo({ url: '/pages/moke/moke' })
  },
  collectTutor() {
    wx.showToast({ title: '示例资料不能收藏', icon: 'none' })
  }
})
