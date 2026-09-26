Page({
  data: {
    currentTab: 0,
    questions: [],
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
    wx.showToast({ title: '播放语音 ' + dur + '秒', icon: 'none' })
  },

  goAsk() {
    wx.switchTab({ url: '/pages/wenzhen/wenzhen' })
  }
})
