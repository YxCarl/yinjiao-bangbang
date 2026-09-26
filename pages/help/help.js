Page({
  data: {
    role: 'student',
    isMentor: false,
    studentGuides: [
      { icon: '磨', theme: 'badge-accent', title: '磨课坊 · 教案精修', desc: '上传教案文档并创建需求；是否有导师接单与指导，取决于实际部署和参与者。' },
      { icon: '诊', theme: 'badge-info', title: '诊课室 · 试讲诊断', desc: '上传试讲视频（≤10分钟）进行模型分析；真实录制与外部处理前需完成知情同意。' },
      { icon: '问', theme: 'badge-primary', title: '问诊室 · 职场解惑', desc: '可选择向导师隐藏档案姓名；问题正文与语音仍可能透露身份，回复取决于实际参与者。' },
      { icon: '服', theme: 'badge-success', title: '指导流程', desc: '发布需求 → 经审核导师接单 → 站内沟通 → 标记完成；评分功能尚未接入。' }
    ],
    mentorGuides: [
      { icon: '接', theme: 'badge-accent', title: '接单大厅', desc: '在工作台查看待接订单，根据自身专长和时段选择合适的单子接取。' },
      { icon: '回', theme: 'badge-info', title: '指导回复', desc: '进入"进行中"订单，通过文字或语音为学员提供专业指导建议。' },
      { icon: '状', theme: 'badge-primary', title: '接单状态', desc: '当前开关仅在本机演示，尚未接入服务端接单限制。' },
      { icon: '收', theme: 'badge-success', title: '收益提现', desc: '演示版未接入真实支付、导师分账或微信提现。' }
    ]
  },

  onLoad() {
    const profile = wx.getStorageSync('myProfile')
    const role = (profile && profile.role) ? profile.role : 'student'
    this.setData({
      role: role,
      isMentor: role === 'mentor'
    })
  }
})
