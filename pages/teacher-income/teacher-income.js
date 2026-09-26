Page({
  data: {
    totalIncome: '—',
    monthIncome: '—',
    todayIncome: '—',
    activeTab: 0,
    records: [],
    allRecords: []
  },

  onLoad() {
    this.filterRecords()
  },

  switchTab(e) {
    this.setData({ activeTab: parseInt(e.currentTarget.dataset.index) }, () => {
      this.filterRecords()
    })
  },

  filterRecords() {
    const { allRecords, activeTab } = this.data
    let records = allRecords
    if (activeTab === 0) {
      records = allRecords
    } else if (activeTab === 1) {
      records = allRecords.filter(r => r.status === '已到账')
    } else if (activeTab === 2) {
      records = allRecords.filter(r => r.status === '提现中')
    }
    this.setData({ records })
  }
})
