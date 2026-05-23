# 银教帮帮

教学经验交流互助平台，为职前教师与资深教育工作者搭建代际传承的桥梁。

## 功能模块

**学生端**
- 磨课坊：上传教案文档，获取精修建议
- 诊课室：上传试讲视频，AI 智能切片分析 + 逐帧诊断
- 问诊室：匿名提交教学困惑，获取经验解答
- 订单管理：追踪需求状态，实时对话交流

**教师端**
- 工作台：浏览需求大厅，接单并进入指导
- 消息中心：与新手教师实时沟通
- 个人管理：收益明细、排班设置、学员评价

## 技术栈

- 微信小程序原生框架
- 微信云开发（云数据库 + 云存储 + 云函数）
- 智谱 GLM-4V 视频分析

## 项目结构

```
├── pages/                  # 页面文件
│   ├── index/              # 首页
│   ├── order/              # 指导订单
│   ├── wenzhen/            # 问诊室
│   ├── moke/               # 磨课坊
│   ├── zhenke/             # 诊课室
│   ├── mine/               # 我的（学生端）
│   ├── teacher/            # 工作台（教师端）
│   ├── teacher-mine/       # 我的（教师端）
│   ├── teacher-msg/        # 消息中心（教师端）
│   ├── teacher-reply/      # 指导回复（教师端）
│   ├── chat/               # 对话页面
│   ├── login/              # 登录页
│   ├── profile/            # 编辑资料
│   ├── wallet/             # 钱包
│   ├── help/               # 使用指南
│   ├── reviews/            # 学员评价
│   ├── search/             # 搜索
│   └── ...                 # 其他页面
├── cloudfunctions/         # 云函数
│   ├── addOrder/           # 创建订单
│   ├── getOrders/          # 获取订单列表
│   ├── sendMessage/        # 发送消息
│   ├── getMessages/        # 获取消息
│   ├── getConversations/   # 获取会话列表
│   ├── loginOrFetch/       # 登录/获取用户信息
│   ├── analyzeVideo/       # AI 视频分析
│   └── getContents/        # 获取内容资源
├── app.js                  # 小程序入口
├── app.json                # 全局配置
├── app.wxss                # 全局样式
└── seed-contents.json      # 内容种子数据
```

## 本地开发

1. 克隆仓库
2. 使用微信开发者工具打开项目目录
3. 在 `app.js` 中将 `env` 改为你自己的云环境 ID
4. 在云开发控制台创建以下数据库集合：
   - `users` — 用户表
   - `orders` — 订单表
   - `messages` — 消息表
   - `conversations` — 会话表
   - `contents` — 内容表
   - `aiTasks` — AI 任务表
   - `config` — 配置表（存储 API Key 等）
5. 上传所有云函数并部署
6. 如需 AI 视频分析功能，在 `config` 集合中添加 `ZHIPU_API_KEY` 记录

## 开源协议

MIT License

## 注意事项

- 本项目为个人学习交流用途，如需商用请自行处理相关资质
- 所有演示数据中的姓名为虚构，如有雷同纯属巧合
- 云函数中的环境 ID 和 AppID 已公开，请勿在生产环境直接使用
