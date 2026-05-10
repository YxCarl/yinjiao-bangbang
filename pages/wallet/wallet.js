Page({
  data: {
    balance: '0.00', // 动态余额
    selectedIndex: 1, 
    rechargeOptions: [
      { price: 49, give: 0 },
      { price: 99, give: 10 },
      { price: 199, give: 30 },
      { price: 299, give: 60 }
    ]
  },

  // 每次进入页面，读取真实余额
  onShow() {
    let currentBalance = wx.getStorageSync('myBalance');
    if (!currentBalance && currentBalance !== 0) {
      currentBalance = 50.00; // 新用户默认送50体验金
      wx.setStorageSync('myBalance', currentBalance);
    }
    this.setData({ balance: parseFloat(currentBalance).toFixed(2) });
  },

  selectOption(e) {
    this.setData({ selectedIndex: e.currentTarget.dataset.index });
  },

  // 核心：处理充值并写入缓存
  payRecharge() {
    const option = this.data.rechargeOptions[this.data.selectedIndex];
    const totalAdd = option.price + option.give; // 本金 + 赠送金

    wx.showLoading({ title: '安全支付中...' });
    setTimeout(() => {
      wx.hideLoading();
      
      // 1. 获取当前老余额
      let oldBalance = parseFloat(wx.getStorageSync('myBalance') || 0);
      // 2. 算出新余额
      let newBalance = oldBalance + totalAdd;
      
      // 3. 存入本地数据库
      wx.setStorageSync('myBalance', newBalance);
      // 4. 更新页面显示
      this.setData({ balance: newBalance.toFixed(2) });

      wx.showToast({ title: `成功充值 ${option.price} 元`, icon: 'success' });
    }, 1200);
  }
})