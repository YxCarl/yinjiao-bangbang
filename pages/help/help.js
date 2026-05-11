Page({
  data: {
    role: 'student',
    isMentor: false,
    studentGuides: [
      { icon: '磨', theme: 'badge-accent', title: '磨课坊 · 教案精修', desc: '上传教案文档，选择学科与导师等级，名师将逐段批注、精修板书与活动设计。' },
      { icon: '诊', theme: 'badge-info', title: '诊课室 · 试讲诊断', desc: '上传试讲视频（≤15分钟），名师逐帧点评教态、语言表达与课堂互动技巧。' },
      { icon: '问', theme: 'badge-primary', title: '问诊室 · 职场解惑', desc: '匿名提交教育职场困惑，名师语音解答，保护隐私的同时获得专业建议。' },
      { icon: '服', theme: 'badge-success', title: '指导流程', desc: '发布需求 → 名师接单 → 专属沟通 → 完成评价，每步清晰可追踪。' }
    ],
    mentorGuides: [
      { icon: '接', theme: 'badge-accent', title: '接单大厅', desc: '在工作台查看待接订单，根据自身专长和时段选择合适的单子接取。' },
      { icon: '回', theme: 'badge-info', title: '指导回复', desc: '进入"进行中"订单，通过文字或语音为学员提供专业指导建议。' },
      { icon: '状', theme: 'badge-primary', title: '接单状态', desc: '在"我的"页面控制上下线。下线后系统不再为您分配新订单，避免休息时被打扰。' },
      { icon: '收', theme: 'badge-success', title: '收益提现', desc: '指导完成后收益自动计入余额，满 1 元即可申请提现至微信钱包，1-3 工作日到账。' }
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
