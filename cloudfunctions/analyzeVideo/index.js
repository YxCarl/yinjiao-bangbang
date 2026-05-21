const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { fileID, taskId } = event

  if (taskId) {
    try {
      const res = await db.collection('aiTasks').doc(taskId).get()
      if (!res.data || res.data._openid !== openid) {
        return { code: -1, error: '无权访问' }
      }
      return { code: 0, data: res.data }
    } catch (e) {
      return { code: -1, error: '查无此任务' }
    }
  }

  try {
    let API_KEY = ''
    try {
      const cfg = await db.collection('config').where({ key: 'ZHIPU_API_KEY' }).get()
      if (cfg.data.length > 0) API_KEY = cfg.data[0].value
    } catch (e) {
      return { code: -1, error: 'API配置读取失败' }
    }
    if (!API_KEY) return { code: -1, error: 'AI服务未配置' }

    let videoUrl = ''
    try {
      const fr = await cloud.getTempFileURL({ fileList: [fileID] })
      if (fr.fileList && fr.fileList[0]) videoUrl = fr.fileList[0].tempFileURL || ''
    } catch (e) {
      return { code: -1, error: '视频链接获取失败' }
    }
    if (!videoUrl) return { code: -1, error: '视频链接为空' }

    const taskDoc = await db.collection('aiTasks').add({
      data: {
        _openid: openid,
        fileID: fileID,
        status: 'processing',
        createTime: db.serverDate(),
        timeline: []
      }
    })

    analyzeAsync(taskDoc._id, videoUrl, API_KEY)

    return { code: 0, data: { status: 'processing', taskId: taskDoc._id } }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '创建分析任务失败' }
  }
}

async function analyzeAsync(taskId, videoUrl, API_KEY) {
  try {
    const https = require('https')
    const urlModule = require('url')

    const requestBody = JSON.stringify({
      model: 'glm-4v-plus',
      messages: [{
        role: 'user',
        content: [
          { type: 'video_url', video_url: { url: videoUrl } },
          { type: 'text', text: '请分析这个课堂教学视频，列出关键教学环节。以JSON数组返回：[{"time":"MM:SS","label":"环节名","desc":"简短描述"}]。按时间排序，只返回JSON。' }
        ]
      }],
      stream: false
    })

    const aiResult = await new Promise((resolve, reject) => {
      const opts = urlModule.parse('https://open.bigmodel.cn/api/paas/v4/chat/completions')
      opts.method = 'POST'
      opts.headers = {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
      }
      const req = https.request(opts, (res) => {
        let d = ''
        res.on('data', c => d += c)
        res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { resolve(d) } })
      })
      req.on('error', (e) => reject(e))
      req.write(requestBody)
      req.end()
    })

    let timeline = []
    if (aiResult && aiResult.choices) {
      const content = aiResult.choices[0].message.content || ''
      timeline = parseTimeline(content)
    }

    await db.collection('aiTasks').doc(taskId).update({
      data: { status: 'done', timeline: timeline }
    })
  } catch (e) {
    console.error(e)
    try {
      await db.collection('aiTasks').doc(taskId).update({
        data: { status: 'error', error: 'AI分析异常' }
      })
    } catch (_) {}
  }
}

function parseTimeline(content) {
  if (!content || typeof content !== 'string') {
    return [{ time: '00:00', label: '分析完成', desc: '请查看视频' }]
  }

  const text = content.trim()

  try {
    const arr = JSON.parse(text)
    if (Array.isArray(arr) && arr.length > 0) return arr.map(item => ({
      time: item.time || '00:00', label: item.label || '环节', desc: item.desc || item.description || ''
    }))
  } catch (e) {}

  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) {
    try {
      const arr = JSON.parse(mdMatch[1].trim())
      if (Array.isArray(arr) && arr.length > 0) return arr.map(item => ({
        time: item.time || '00:00', label: item.label || '环节', desc: item.desc || item.description || ''
      }))
    } catch (e) {}
  }

  const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0])
      if (Array.isArray(arr) && arr.length > 0) return arr.map(item => ({
        time: item.time || '00:00', label: item.label || '环节', desc: item.desc || item.description || ''
      }))
    } catch (e) {}
  }

  const lines = text.split('\n').filter(l => l.trim())
  const timeline = []
  for (const line of lines) {
    const timeMatch = line.match(/(\d{1,2}:\d{2})/)
    if (!timeMatch) continue
    const time = timeMatch[1]
    const rest = line.replace(timeMatch[0], '').replace(/^[\s\-:：]+/, '').trim()
    const parts = rest.split(/[\s]+/)
    timeline.push({ time, label: parts[0] || '环节', desc: parts.slice(1).join(' ') || rest })
  }
  if (timeline.length > 0) return timeline

  return [{ time: '00:00', label: '分析结果', desc: text.substring(0, 50) }]
}
