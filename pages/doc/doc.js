Page({
  saveDoc() { wx.showToast({ title: '收藏成功', icon: 'success' }); },
  downloadDoc() { 
    wx.showLoading({ title: '获取中...' });
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '已发送至您的邮箱', icon: 'none' });
    }, 1000);
  }
})