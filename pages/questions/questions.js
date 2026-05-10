Page({
  data: {
    currentTab: 0,
    questions: [
      { id: 1, time: '昨天 10:20', answered: true, content: '考编选岗纠结：市直老牌学校和区属新建学校怎么选？自身抗压能力一般。', teacher: '刘校长 · 正高级', dur: 56 },
      { id: 2, time: '刚刚', answered: false, content: '入职一个月，不知道如何跟强势的家长沟通，总是很害怕接家长电话怎么办？', teacher: '' },
      { id: 3, time: '3天前', answered: true, content: '试讲全程紧张到声音发抖，有什么实用的快速调整方法吗？', teacher: '李建国 · 特级教师', dur: 72 }
    ],
    filtered: []
  },

  onLoad() { this.filterData() },

  switchTab(e) {
    this.setData({ currentTab: parseInt(e.currentTarget.dataset.index) })
    this.filterData()
  },

  filterData() {
    let filtered = this.data.questions
    if (this.data.currentTab === 1) filtered = this.data.questions.filter(q => q.answered)
    else if (this.data.currentTab === 2) filtered = this.data.questions.filter(q => !q.answered)
    this.setData({ filtered })
  },

  playAudio(e) {
    const dur = e.currentTarget.dataset.dur
    wx.showToast({ title: '播放语音 ' + dur + '秒 (演示)', icon: 'none' })
  },

  goAsk() {
    wx.switchTab({ url: '/pages/wenzhen/wenzhen' })
  }
})
