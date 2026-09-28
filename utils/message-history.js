function compare(left, right) {
  const time = (Date.parse(left.createTime) || 0) - (Date.parse(right.createTime) || 0)
  return time || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

function loadMessagePage(page, wx, field, mode = 'latest') {
  if (!page.data.conversationId) return
  const state = page._messagePaging || (page._messagePaging = {
    busy: false, latest: '', older: '', hasOlder: false, disposed: false, forwardPages: 0
  })
  if (state.busy || state.disposed || (mode === 'older' && !state.hasOlder)) return
  const initial = !state.latest
  // Hash IDs are not commit-ordered. Reconcile the newest window periodically
  // so a late write behind the forward cursor can still appear in the UI.
  const refresh = mode === 'refresh' || (mode === 'latest' && state.forwardPages >= 10)
  const request = { conversationId: page.data.conversationId }
  if (mode === 'older') request.cursor = state.older
  else if (!initial && !refresh) { request.cursor = state.latest; request.direction = 'after' }
  const anchor = page.data[field].length ? page.data[field][0].id : ''
  state.busy = true
  page.setData({ loadingMessages: true, messageLoadError: false })
  const fail = result => {
    state.busy = false
    if (state.disposed) return
    const update = { loadingMessages: false, messageLoadError: true }
    if (result && [ -2, -3 ].includes(result.code)) {
      state.latest = ''; state.older = ''; state.hasOlder = false; state.forwardPages = 0
      update[field] = []; update.hasOlder = false
    }
    page.setData(update)
  }
  wx.cloud.callFunction({
    name: 'getMessages', data: request,
    success(res) {
      if (state.disposed) return
      const result = res.result || {}
      if (result.code !== 0 || !Array.isArray(result.data)) return fail(result)
      state.busy = false
      const merged = new Map(page.data[field].map(message => [message.id, message]))
      for (const message of result.data) {
        merged.set(message._id, {
          id: message._id, side: message.side, kind: message.kind || 'text',
          text: message.content || '', fileID: message.fileID || '', dur: message.dur || 0,
          createTime: message.createTime || '', time: ''
        })
      }
      const messages = Array.from(merged.values()).sort(compare)
      if (initial || mode === 'older') {
        state.older = result.nextCursor || ''
        state.hasOlder = result.hasMore === true && Boolean(state.older)
      }
      // A head refresh must not jump the forward cursor over a >50-row backlog.
      if (mode !== 'older' && (!refresh || initial) && result.latestCursor) state.latest = result.latestCursor
      if (refresh || initial) state.forwardPages = 0
      else if (mode !== 'older') state.forwardPages += 1
      const update = { [field]: messages, loadingMessages: false, hasOlder: state.hasOlder, messageLoadError: false }
      if (mode === 'older' && anchor) update.messageScrollTarget = 'msg-' + anchor
      else if (result.data.length && messages.length) update.messageScrollTarget = 'msg-' + messages[messages.length - 1].id
      page.setData(update)
    },
    fail() { fail() }
  })
}

module.exports = { loadMessagePage }
