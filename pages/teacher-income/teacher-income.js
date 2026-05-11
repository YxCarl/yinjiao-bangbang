Page({
  data: {
    totalIncome: '8,640.00',
    monthIncome: '1,280.00',
    todayIncome: '320.00',
    activeTab: 0,
    records: [],
    allRecords: [
      { id: 1, orderType: '诊课室', title: '试讲视频诊断（15分钟）', student: '林老师', amount: '128.00', time: '2026-05-10 16:30', status: '已到账' },
      { id: 2, orderType: '磨课坊', title: '初中数学《勾股定理》说课稿把关', student: '张同学', amount: '59.00', time: '2026-05-09 14:00', status: '已到账' },
      { id: 3, orderType: '磨课坊', title: '小学语文《桂林山水》教案精修', student: '周同学', amount: '89.00', time: '2026-05-09 10:00', status: '已到账' },
      { id: 4, orderType: '问诊室', title: '入职新教师 家校沟通困惑', student: '王老师', amount: '29.00', time: '2026-05-08 09:00', status: '已到账' },
      { id: 5, orderType: '诊课室', title: '高中英语阅读课试讲诊断', student: '刘老师', amount: '128.00', time: '2026-05-06 11:20', status: '已到账' },
      { id: 6, orderType: '磨课坊', title: '小学科学《水的三态》教案设计', student: '赵同学', amount: '89.00', time: '2026-05-03 08:40', status: '已到账' },
      { id: 7, orderType: '问诊室', title: '考编面试说课环节辅导', student: '孙老师', amount: '29.00', time: '2026-05-01 15:00', status: '提现中' }
    ]
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
