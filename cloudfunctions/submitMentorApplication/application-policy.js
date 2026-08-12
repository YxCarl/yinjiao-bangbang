function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function validateApplication(input) {
  const data = {
    name: cleanText(input && input.name, 30),
    subject: cleanText(input && input.subject, 40),
    years: cleanText(input && input.years, 2),
    summary: cleanText(input && input.summary, 500)
  }

  if (!data.name) return { ok: false, error: '请填写姓名' }
  if (!data.subject) return { ok: false, error: '请填写擅长学科' }
  if (!/^\d{1,2}$/.test(data.years) || Number(data.years) > 60) {
    return { ok: false, error: '教龄应为 0 到 60 的整数' }
  }
  if (data.summary.length < 10) {
    return { ok: false, error: '资历说明至少填写 10 个字' }
  }

  return { ok: true, data: data }
}

module.exports = { cleanText, validateApplication }
