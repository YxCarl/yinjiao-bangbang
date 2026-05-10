Page({
  data: { questionText: '', isAnonymous: true },

  onInput(e) { this.setData({ questionText: e.detail.value }); },
  onAnonymousChange(e) { this.setData({ isAnonymous: e.detail.value }); },

  submitQuestion() {
    if (this.data.questionText.length < 10) return wx.showToast({ title: '请至少描述10个字', icon: 'none' });

    wx.showLoading({ title: '正在提交云端...' });
    wx.cloud.callFunction({
      name: 'addOrder',
      data: {
        typeText: '问诊室',
        title: (this.data.isAnonymous ? '【匿名】' : '') + '教育职场咨询',
        price: 29,
        detail: { content: this.data.questionText }
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => { wx.switchTab({ url: '/pages/order/order' }); }, 1500);
      }
    });
  }
})