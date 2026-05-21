Page({
  data: {
    searchKeyword: '',
    hasSearched: false,
    history: [],
    hotSearches: ['考编面试指南', '无生试讲', '小学语文', '结构化面试', '板书设计', '家校沟通'],
    searchResults: []
  },

  onLoad() {
    const h = wx.getStorageSync('searchHistory')
    if (h && h.length) this.setData({ history: h })
  },

  goBack() { wx.navigateBack() },

  clearHistory() {
    this.setData({ history: [] })
    wx.setStorageSync('searchHistory', [])
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
    wx.showLoading({ title: '搜索中...' })

    let newHistory = this.data.history
    if (!newHistory.includes(keyword)) newHistory.unshift(keyword)
    if (newHistory.length > 8) newHistory = newHistory.slice(0, 8)
    wx.setStorageSync('searchHistory', newHistory)
    this.setData({ history: newHistory })

    wx.cloud.callFunction({
      name: 'getContents',
      data: { keyword: keyword },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          this.setData({ hasSearched: true, searchResults: res.result.data })
        } else {
          this.setData({ hasSearched: true, searchResults: [] })
        }
      },
      fail: () => {
        wx.hideLoading()
        this.setData({ hasSearched: true, searchResults: [] })
      }
    })
  },

  goToDetail(e) {
    const type = e.currentTarget.dataset.type
    const id = e.currentTarget.dataset.id
    if (type === 'course') wx.navigateTo({ url: '/pages/course/course?id=' + id })
    else if (type === 'doc') wx.navigateTo({ url: '/pages/doc/doc?id=' + id })
    else if (type === 'tutor') wx.navigateTo({ url: '/pages/tutor/tutor' })
  }
})
