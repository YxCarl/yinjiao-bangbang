const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { type, id, keyword } = event

  try {
    let query = db.collection('contents')

    if (id) {
      const res = await query.doc(id).get()
      return { code: 0, data: res.data ? [res.data] : [] }
    }

    if (type) {
      query = query.where({ type: type })
    }

    const result = await query.orderBy('sort', 'asc').limit(30).get()

    let list = result.data
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter(item => {
        const haystack = (item.title + ' ' + (item.desc || '') + ' ' + (item.tags || []).join(' ')).toLowerCase()
        return haystack.includes(kw)
      })
    }

    return { code: 0, data: list }
  } catch (e) {
    console.error(e)
    return { code: -1, error: '加载内容失败' }
  }
}
