Page({
  data: {
    name: '',
    tag: '',
    avatar: '新',
    id: '',
    role: 'student',
    studentTags: ['在校师范生', '新入职教师(0-3年)', '合同制代课教师', '教培行业老师', '考编备考'],
    mentorTags: ['退休教师', '在岗资深教师', '学科带头人', '名师工作室主持人'],
    tags: [],
    title: '',
    subject: '',
    years: '',
    titleOptions: ['一级教师', '高级教师', '正高级教师', '特级教师'],
    subjectOptions: ['小学语文', '小学数学', '初中英语', '初中语文', '高中物理', '高中化学', '幼儿教育']
  },

  onLoad() {
    let stored = wx.getStorageSync('myProfile') || {}
    const role = stored.role || 'student'
    this.setData({
      name: stored.name || '',
      tag: stored.tag || '',
      avatar: stored.avatar || (role === 'mentor' ? '师' : '新'),
      id: stored.id || '',
      role: role,
      tags: role === 'mentor' ? this.data.mentorTags : this.data.studentTags,
      title: stored.title || '',
      subject: stored.subject || '',
      years: stored.years || ''
    })
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onYearsInput(e) { this.setData({ years: e.detail.value }) },
  onTagChange(e) { this.setData({ tag: this.data.tags[e.detail.value] }) },
  onTitleChange(e) { this.setData({ title: this.data.titleOptions[e.detail.value] }) },
  onSubjectChange(e) { this.setData({ subject: this.data.subjectOptions[e.detail.value] }) },

  saveProfile() {
    if (!this.data.name.trim()) return wx.showToast({ title: '姓名不能为空', icon: 'none' })

    wx.showLoading({ title: '保存中...' })

    const oldProfile = wx.getStorageSync('myProfile') || {}
    const newProfile = Object.assign({}, oldProfile, {
      name: this.data.name,
      tag: this.data.tag,
      avatar: this.data.name[0] || (this.data.role === 'mentor' ? '师' : '新'),
      id: this.data.id,
      role: this.data.role
    })
    if (this.data.role === 'mentor') {
      newProfile.title = this.data.title
      newProfile.subject = this.data.subject
      newProfile.years = this.data.years
    }

    setTimeout(() => {
      wx.hideLoading()
      wx.setStorageSync('myProfile', newProfile)
      wx.showToast({ title: '档案已更新', icon: 'success' })
      setTimeout(() => { wx.navigateBack() }, 1000)
    }, 600)
  }
})
