function loadConversationPage(page, wx, more = false) {
  let state = page._conversationPaging
  if (more) {
    if (!state || state.busy || !state.cursor) return
  } else {
    state = { busy: false, cursor: '' }
    page._conversationPaging = state
  }
  state.busy = true
  page.setData({ loadingConversations: true, loadError: false })
  const fail = result => {
    if (page._conversationPaging !== state) return
    state.busy = false
    const patch = { loadError: true, loadingConversations: false }
    if (result && [-2, -3].includes(result.code)) {
      patch.conversations = []; patch.filteredList = []; patch.msgUnread = 0
      patch.hasMoreConversations = false; state.cursor = ''
    }
    page.setData(patch)
    wx.showToast({ title: '消息加载失败，请重试', icon: 'none' })
  }
  wx.cloud.callFunction({
    name: 'getConversations',
    data: more ? { cursor: state.cursor } : {},
    success(res) {
      if (page._conversationPaging !== state) return
      const result = res.result || {}
      if (result.code !== 0 || !Array.isArray(result.data)) return fail(result)
      state.busy = false
      state.cursor = result.hasMore === true ? (result.nextCursor || '') : ''
      const mapped = result.data.map(item => ({
        id: item._id, conversationId: item.conversationId, type: 'chat',
        char: item.peerName ? item.peerName[0] : '学', theme: item.peerTheme || 'badge-primary',
        name: item.peerName || '学员', desc: item.orderTitle || '',
        time: page._formatTime(item.lastTime), lastTime: item.lastTime,
        preview: item.lastMsg || '', unread: item.unread || 0
      }))
      const merged = new Map()
      for (const item of (more ? page.data.conversations : []).concat(mapped)) {
        const key = item.conversationId || item.id
        const previous = merged.get(key)
        if (!previous || Date.parse(item.lastTime) >= Date.parse(previous.lastTime)) merged.set(key, item)
      }
      const conversations = Array.from(merged.values()).sort((a, b) => (
        (Date.parse(b.lastTime) || 0) - (Date.parse(a.lastTime) || 0)
      ))
      page.setData({
        conversations, filteredList: conversations,
        msgUnread: conversations.reduce((sum, item) => sum + item.unread, 0),
        listLimited: result.scanLimitReached === true, loadError: false,
        loadingConversations: false, hasMoreConversations: Boolean(state.cursor)
      })
    },
    fail() { fail() }
  })
}

module.exports = { loadConversationPage }
