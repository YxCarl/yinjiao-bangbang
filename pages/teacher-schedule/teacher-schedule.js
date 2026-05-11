Page({
  data: {
    days: [
      { key: 'mon', label: '周一', active: true },
      { key: 'tue', label: '周二', active: true },
      { key: 'wed', label: '周三', active: true },
      { key: 'thu', label: '周四', active: true },
      { key: 'fri', label: '周五', active: true },
      { key: 'sat', label: '周六', active: false },
      { key: 'sun', label: '周日', active: false }
    ],
    timeSlots: [
      { key: 'morning', label: '上午', time: '08:00 - 12:00', active: true },
      { key: 'afternoon', label: '下午', time: '14:00 - 18:00', active: true },
      { key: 'evening', label: '晚间', time: '19:00 - 22:00', active: false }
    ],
    maxOrders: 5,
    maxOptions: [3, 5, 8, 10]
  },

  toggleDay(e) {
    const key = e.currentTarget.dataset.key
    const days = this.data.days.map(d => {
      if (d.key === key) d.active = !d.active
      return d
    })
    this.setData({ days })
  },

  toggleSlot(e) {
    const key = e.currentTarget.dataset.key
    const slots = this.data.timeSlots.map(s => {
      if (s.key === key) s.active = !s.active
      return s
    })
    this.setData({ timeSlots: slots })
  },

  onMaxChange(e) {
    this.setData({ maxOrders: this.data.maxOptions[e.detail.value] })
  },

  saveSchedule() {
    wx.showToast({ title: '排班已保存', icon: 'success' })
  }
})
