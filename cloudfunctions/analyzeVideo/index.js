const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// AI 配置 — 替换为你的 API 地址和密钥
const AI_CONFIG = {
  endpoint: 'https://your-ai-api.com/video/analyze',
  apiKey: 'your-api-key-here'
}

exports.main = async (event, context) => {
  const { fileID } = event

  try {
    // 获取临时下载链接
    const fileResult = await cloud.getTempFileURL({ fileList: [fileID] })
    const videoUrl = fileResult.fileList[0].tempFileURL

    // ===== 调用 AI API（示例） =====
    // 取消注释以下代码并替换真实 API：
    //
    // const response = await fetch(AI_CONFIG.endpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_CONFIG.apiKey },
    //   body: JSON.stringify({ videoUrl: videoUrl })
    // })
    // const aiResult = await response.json()
    // return { code: 0, data: aiResult.timeline }

    // ===== 本地模拟（正式接入 API 后删除） =====
    // 基于视频时长做一个合理的切片模拟
    return {
      code: 0,
      data: [
        { time: '00:00', label: '课堂导入', desc: '开场白与情境创设' },
        { time: '02:30', label: '新课讲授', desc: '核心知识点讲解与板书' },
        { time: '08:00', label: '互动提问', desc: '师生问答与课堂互动' },
        { time: '12:15', label: '练习巩固', desc: '随堂练习与即时反馈' },
        { time: '16:40', label: '课堂小结', desc: '知识点回顾与作业布置' }
      ]
    }
  } catch (e) {
    console.error(e)
    // 失败时返回空数据
    return { code: -1, error: e.message }
  }
}
