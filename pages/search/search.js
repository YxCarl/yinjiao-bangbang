Page({
  data: {
    searchKeyword: '',
    hasSearched: false,
    history: ['李建国', '教案精修模板', '面试礼仪'],
    hotSearches: ['考编面试指南', '无生试讲', '小学语文第一课时', '结构化面试题库', '板书设计', '家校沟通'],
    searchResults: [],

    mockDatabase: [
      { id: 1, type: 'tutor', name: '李建国', char: '李', title: '中学语文 · 特级教师', tags: ['考编评委', '试讲指导'], desc: '考编面试主考官，专治试讲不自信。' },
      { id: 2, type: 'tutor', name: '王素芬', char: '王', title: '小学数学 · 高级教师', tags: ['教资评委', '板书设计'], desc: '30年教龄，精准把控教姿教态与板书。' },
      { id: 3, type: 'tutor', name: '张维民', char: '张', title: '高中物理 · 正高级', tags: ['学科带头人', '大单元设计'], desc: '深入浅出，擅长攻克重难点教学设计。' },
      { id: 4, type: 'doc', name: '教案精修模板', char: '案', title: '核心资料库', tags: ['磨课坊', '高分教案'], desc: '历年考编高分教案合集，覆盖全学段，助你理清思路。' },
      { id: 5, type: 'service', name: '无生试讲全攻略', char: '课', title: '系统课程', tags: ['诊课室', '面试必备'], desc: '无生试讲如何互动？这套名师方法论告诉你。' }
    ]
  },

  goBack() { wx.navigateBack() },
  clearHistory() {
    this.setData({ history: [] })
    wx.showToast({ title: '历史已清空', icon: 'none' })
  },
  onInput(e) {
    const value = e.detail.value
    this.setData({ searchKeyword: value })
    if (!value) this.setData({ hasSearched: false, searchResults: [] })
  },
  clearInput() {
    this.setData({ searchKeyword: '', hasSearched: false, searchResults: [] })
  },
  clickTag(e) {
    const text = e.currentTarget.dataset.text
    this.setData({ searchKeyword: text })
    this.performSearch(text)
  },
  onSearch(e) {
    const text = e.detail.value.trim()
    if (!text) return
    this.performSearch(text)
  },

  performSearch(keyword) {
    wx.showLoading({ title: '检索中...' })
    let newHistory = this.data.history
    if (!newHistory.includes(keyword)) newHistory.unshift(keyword)

    setTimeout(() => {
      wx.hideLoading()
      const results = this.data.mockDatabase.filter(item => {
        return item.name.includes(keyword) ||
               item.tags.some(tag => tag.includes(keyword)) ||
               item.desc.includes(keyword) ||
               item.title.includes(keyword)
      })

      this.setData({
        hasSearched: true,
        searchResults: results,
        history: newHistory.slice(0, 8)
      })
    }, 400)
  },

  goToDetail(e) {
    const type = e.currentTarget.dataset.type
    if (type === 'tutor') wx.navigateTo({ url: '/pages/tutor/tutor' })
    else if (type === 'doc') wx.navigateTo({ url: '/pages/doc/doc' })
    else if (type === 'service') wx.navigateTo({ url: '/pages/course/course' })
  }
})
