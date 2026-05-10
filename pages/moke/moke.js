Page({
  data: {
    hasFile: false,
    fileName: '', // 用于存储真实的文件名
    subjects: ['小学语文', '小学数学', '初中英语', '高中物理', '幼儿教育'],
    teacherLevels: ['高级教师', '特级教师', '有评委经历(优先)'],
    selectedSubject: '',
    selectedLevel: '',
    priceAmount: ''
  },

  onSubjectChange(e) { 
    this.setData({ selectedSubject: this.data.subjects[e.detail.value] }); 
  },
  
  onLevelChange(e) { 
    this.setData({ selectedLevel: this.data.teacherLevels[e.detail.value] }); 
  },
  
  // 选文件接口
  chooseFile() {
    wx.chooseMessageFile({
      count: 1, 
      type: 'file', 
      extension: ['doc', 'docx', 'pdf'], 
      success: (res) => {
        const file = res.tempFiles[0];
        if (file.size > 50 * 1024 * 1024) {
          return wx.showToast({ title: '文件太大，请选择50MB以内的文档', icon: 'none' });
        }
        this.setData({ 
          hasFile: true,
          fileName: file.name
        });
        wx.showToast({ title: '已选择文件', icon: 'success' });
      },
      fail: (err) => {
        if(err.errMsg.indexOf('cancel') === -1){
          wx.showToast({ title: '选择文件失败', icon: 'none' });
        }
      }
    });
  },

  onPriceInput(e) {
    let val = e.detail.value;
    this.setData({ priceAmount: val });
  },

  // 核心：提交到云端
  submitOrder() {
    // 拦截校验
    if (!this.data.hasFile) return wx.showToast({ title: '请先上传教案文档', icon: 'none' });
    if (!this.data.selectedSubject) return wx.showToast({ title: '请选择学段学科', icon: 'none' });
    if (!this.data.selectedLevel) return wx.showToast({ title: '请选择期望教师等级', icon: 'none' });
    
    let finalPrice = parseFloat(this.data.priceAmount);
    if (!finalPrice || isNaN(finalPrice) || finalPrice < 49) {
      return wx.showToast({ title: '教案精修悬赏最低 49 元起哦', icon: 'none', duration: 2000 });
    }

    wx.showLoading({ title: '正在云端派单...' });

    // 呼叫云端接口
    wx.cloud.callFunction({
      name: 'addOrder',
      data: {
        typeText: '磨课坊',
        title: `${this.data.selectedSubject} 教案精修`,
        price: finalPrice,
        detail: {
          subject: this.data.selectedSubject,
          level: this.data.selectedLevel,
          fileName: this.data.fileName
        }
      },
      success: res => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/order/order' });
        }, 1500);
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '派单失败，请检查网络', icon: 'none' });
        console.error('云函数调用报错', err);
      }
    });
  }
})