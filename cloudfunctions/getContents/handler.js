const PAGE_SIZE = 30
const SCAN_LIMIT = 300

function matchesKeyword(content, keyword) {
  if (!content || typeof content !== 'object') return false
  const tags = Array.isArray(content.tags) ? content.tags.filter(tag => typeof tag === 'string') : []
  const fields = [content.title, content.name, content.desc, ...tags]
  return fields.filter(field => typeof field === 'string').join(' ').toLowerCase().includes(keyword)
}

function createGetContentsHandler({ database, logger = console }) {
  return async (event = {}) => {
    const { id, type, keyword } = event || {}
    if ((id != null && (typeof id !== 'string' || !id.trim() || id.length > 128)) ||
        (type != null && (typeof type !== 'string' || type.length > 40)) ||
        (keyword != null && (typeof keyword !== 'string' || keyword.length > 80))) {
      return { code: -1, error: '内容参数无效' }
    }

    try {
      if (id) {
        const content = await database.getById(id)
        return { code: 0, data: content ? [content] : [] }
      }

      const search = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
      const matches = []
      let scanned = 0
      let exhausted = false
      while (scanned < (search ? SCAN_LIMIT : PAGE_SIZE) && matches.length < PAGE_SIZE) {
        const batch = await database.list(type || '', scanned, PAGE_SIZE)
        if (!Array.isArray(batch)) throw new Error('Invalid content query response')
        scanned += batch.length
        matches.push(...(search ? batch.filter(item => matchesKeyword(item, search)) : batch))
        if (batch.length < PAGE_SIZE) {
          exhausted = true
          break
        }
      }

      return {
        code: 0,
        data: matches.slice(0, PAGE_SIZE),
        limited: !exhausted && (matches.length >= PAGE_SIZE || scanned >= SCAN_LIMIT)
      }
    } catch (error) {
      logger.error('Content query failed', error)
      return { code: -1, error: '加载内容失败' }
    }
  }
}

module.exports = { createGetContentsHandler, matchesKeyword }
