Page({
  data: {
    favorites: []
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
