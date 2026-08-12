const STATUS_COPY = {
  not_requested: {
    label: '尚未申请',
    description: '填写基本资历后提交。提交只会进入待审核状态，不会直接获得导师权限。'
  },
  pending: {
    label: '等待独立审核',
    description: '申请已保存。审核完成前，账号继续使用学员权限。'
  },
  approved: {
    label: '审核已通过',
    description: '服务端已确认导师身份，可以进入导师工作台。'
  },
  rejected: {
    label: '需要补充资料',
    description: '请根据审核反馈补充资历说明后重新提交。'
  }
}

Page({
  data: {
    mentorStatus: 'not_requested',
    statusLabel: STATUS_COPY.not_requested.label,
    statusDescription: STATUS_COPY.not_requested.description,
    name: '',
    subject: '',
    years: '',
    summary: '',
    submitting: false,
    canSubmit: true,
    approved: false
  },

  onLoad() {
    this._loadProfile()
  },

  _loadProfile() {
    const profile = wx.getStorageSync('myProfile') || {}
    const application = profile.mentorApplication || {}
    const status = STATUS_COPY[profile.mentorStatus]
      ? profile.mentorStatus
      : (profile.role === 'mentor' ? 'pending' : 'not_requested')
    const copy = STATUS_COPY[status]

    this.setData({
      mentorStatus: status,
      statusLabel: copy.label,
      statusDescription: copy.description,
      name: application.name || profile.name || '',
      subject: application.subject || profile.subject || '',
      years: application.years || profile.years || '',
      summary: application.summary || '',
      canSubmit: status === 'not_requested' || status === 'rejected',
      approved: profile.role === 'mentor' && status === 'approved'
    })
  },

  onFieldInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  submitApplication() {
    if (!this.data.canSubmit || this.data.submitting) return
    if (!this.data.name.trim()) return wx.showToast({ title: '请填写姓名', icon: 'none' })
    if (!this.data.subject.trim()) return wx.showToast({ title: '请填写擅长学科', icon: 'none' })
    if (!/^\d{1,2}$/.test(this.data.years) || Number(this.data.years) > 60) {
      return wx.showToast({ title: '教龄应为 0 到 60 的整数', icon: 'none' })
    }
    if (this.data.summary.trim().length < 10) {
      return wx.showToast({ title: '资历说明至少填写 10 个字', icon: 'none' })
    }

    const userId = wx.getStorageSync('userId') || ''
    if (!userId || userId.startsWith('local_')) {
      wx.showModal({
        title: '离线预览无法提交',
        content: '请配置独立云开发环境并部署 submitMentorApplication 云函数后再提交。',
        showCancel: false
      })
      return
    }

    this.setData({ submitting: true })
    wx.cloud.callFunction({
      name: 'submitMentorApplication',
      data: {
        name: this.data.name,
        subject: this.data.subject,
        years: this.data.years,
        summary: this.data.summary
      },
      success: (res) => {
        if (!(res.result && res.result.code === 0)) {
          wx.showToast({ title: (res.result && res.result.error) || '提交失败', icon: 'none' })
          return
        }
        const profile = res.result.data
        wx.setStorageSync('myProfile', profile)
        wx.setStorageSync('userRole', profile.role)
        this._loadProfile()
        const title = res.result.alreadyApproved
          ? '身份已通过审核'
          : (res.result.alreadyPending ? '申请正在审核' : '申请已提交')
        wx.showToast({ title: title, icon: 'success' })
      },
      fail: () => {
        wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  },

  openWorkspace() {
    if (!this.data.approved) return
    wx.redirectTo({ url: '/pages/teacher/teacher' })
  },

  useStudentMode() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
