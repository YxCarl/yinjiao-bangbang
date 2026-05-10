Page({
  data: {
    favorites: [
      { id: 1, type: 'tutor', char: '李', theme: 'badge-primary', name: '李建国', desc: '特级教师 · 考编评委' },
      { id: 2, type: 'doc', char: '案', theme: 'badge-accent', name: '教案精修模板库', desc: '覆盖 8 大学科万能模板' },
      { id: 3, type: 'tutor', char: '王', theme: 'badge-info', name: '王素芬', desc: '高级教师 · 30 年教龄' }
    ]
  },

  goToTutor() { wx.navigateTo({ url: '/pages/tutor/tutor' }) },
  goToDoc() { wx.navigateTo({ url: '/pages/doc/doc' }) },

  goItem(e) {
    const type = e.currentTarget.dataset.type
    if (type === 'tutor') this.goToTutor()
    else if (type === 'doc') this.goToDoc()
  },

  cancelFav(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏吗？',
      confirmColor: '#D14040',
      success: (res) => {
        if (res.confirm) {
          const newList = this.data.favorites.filter(f => f.id !== id)
          this.setData({ favorites: newList })
          wx.showToast({ title: '已取消', icon: 'success' })
        }
      }
    })
  }
})
