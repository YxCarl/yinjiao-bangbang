Page({
  data: {
    peerName: '名师',
    peerChar: '师',
    peerTheme: 'badge-primary',
    inputText: '',
    messages: [
      { id: 1, side: 'in', kind: 'voice', dur: 45, text: '语音 45"' },
      { id: 2, side: 'in', kind: 'text', text: '这部分的板书设计还可以再精简一下，突出"重点字+逻辑箭头"的层次。' },
      { id: 3, side: 'out', kind: 'text', text: '老师好，我明白了！那导入部分的提问设计您觉得还需要怎么改？' },
      { id: 4, side: 'in', kind: 'text', text: '导入提问要更聚焦于学生已有经验，避免一上来抛大问题。可以从一个生活场景切入。' }
    ]
  },

  onLoad(options) {
    if (options.name) this.setData({ peerName: decodeURIComponent(options.name) })
    if (options.char) this.setData({ peerChar: decodeURIComponent(options.char) })
    if (options.theme) this.setData({ peerTheme: options.theme })
    wx.setNavigationBarTitle({ title: this.data.peerName })
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  sendMsg() {
    const text = this.data.inputText.trim()
    if (!text) return
    const list = this.data.messages.slice()
    list.push({ id: Date.now(), side: 'out', kind: 'text', text })
    this.setData({ messages: list, inputText: '' })

    // 模拟自动回复
    setTimeout(() => {
      const reply = {
        id: Date.now() + 1,
        side: 'in',
        kind: 'text',
        text: '收到，我一会儿仔细看下你的问题再回复你～'
      }
      const updated = this.data.messages.slice()
      updated.push(reply)
      this.setData({ messages: updated })
    }, 1200)
  },

  playVoice() {
    wx.showToast({ title: '播放语音 (演示)', icon: 'none' })
  }
})
