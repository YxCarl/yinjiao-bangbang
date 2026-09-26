const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')

function loadPage(name, wx) {
  let definition
  const source = fs.readFileSync(path.join(root, 'pages', name, `${name}.js`), 'utf8')
  vm.runInNewContext(source, { Page(page) { definition = page }, wx })
  return { ...definition, data: { ...definition.data } }
}

function mountPage(name, wx) {
  const page = loadPage(name, wx)
  page.setData = update => { Object.assign(page.data, update) }
  return page
}

test('demo recharge and withdrawal cannot change balances or claim payment success', () => {
  const actions = []
  const wx = {
    showModal(options) { actions.push(options) },
    setStorageSync() { throw new Error('A demo payment must not mutate local balance') },
    showToast() { throw new Error('A demo payment must not claim success') }
  }
  loadPage('wallet', wx).payRecharge()
  loadPage('teacher-mine', wx).doWithdraw()

  assert.equal(actions.length, 2)
  assert.equal(actions.every(action => action.showCancel === false), true)
  assert.match(actions[0].content, /未接入微信支付/)
  assert.match(actions[1].content, /不会提交提现申请/)
})

test('optional content fixture contains no invented teachers or usage counts', () => {
  const records = JSON.parse(fs.readFileSync(path.join(root, 'seed-contents.json'), 'utf8'))
  assert.equal(records.length > 0, true)
  for (const record of records) {
    assert.equal(Object.hasOwn(record, 'viewCount'), false)
    assert.doesNotMatch(JSON.stringify(record), /特级教师|高级教师|正高级|90\+ 分/)
    if (record.author) assert.match(record.author, /示例内容/)
  }
})

test('demo-only pages disclose missing payments, lessons and ratings', () => {
  for (const [page, disclosure] of [
    ['wallet', '未接入真实支付'],
    ['teacher-mine', '未接入真实收入'],
    ['teacher-income', '没有真实支付'],
    ['course', '暂无课程视频'],
    ['reviews', '不展示虚构评分']
  ]) {
    const source = fs.readFileSync(path.join(root, 'pages', page, `${page}.wxml`), 'utf8')
    assert.ok(source.includes(disclosure), `${page} must disclose its demo boundary`)
  }
})

test('student conversation page ignores stale local examples and renders only authorized cloud results', () => {
  let request
  const wx = {
    getStorageSync() { return [{ id: 'local_fake', name: '虚构导师' }] },
    setStorageSync() { throw new Error('Conversations must not be cached as real records') },
    cloud: { callFunction(options) { request = options } },
    showToast() { throw new Error('Empty authorized response is not a failure') }
  }
  const page = mountPage('message', wx)
  page.onShow()
  assert.equal(page.data.conversations.length, 0)
  assert.equal(request.name, 'getConversations')
  request.success({ result: { code: 0, data: [] } })
  assert.equal(page.data.conversations.length, 0)
  page._tryCloudSync()
  request.success({ result: { code: 0, data: [], scanLimitReached: true } })
  assert.equal(page.data.listLimited, true)
})

test('mentor conversation page ignores stale local examples and renders only authorized cloud results', () => {
  let request
  const wx = {
    getStorageSync(key) {
      if (key === 'myProfile') return { role: 'mentor', mentorStatus: 'approved' }
      return [{ id: 'local_fake', name: '虚构学员' }]
    },
    setStorageSync() { throw new Error('Conversations must not be cached as real records') },
    cloud: { callFunction(options) { request = options } },
    showToast() { throw new Error('Empty authorized response is not a failure') }
  }
  const page = mountPage('teacher-msg', wx)
  page.onShow()
  assert.equal(page.data.conversations.length, 0)
  assert.equal(page.data.filteredList.length, 0)
  assert.equal(request.name, 'getConversations')
  request.success({ result: { code: 0, data: [] } })
  assert.equal(page.data.conversations.length, 0)
  assert.equal(page.data.filteredList.length, 0)
  assert.equal(page.data.msgUnread, 0)
  page._tryCloudSync()
  request.success({ result: { code: 0, data: [], scanLimitReached: true } })
  assert.equal(page.data.listLimited, true)
})

test('chat and mentor reply do not show unconfirmed messages or fake send success', () => {
  for (const name of ['chat', 'teacher-reply']) {
    let definition
    const requests = []
    const toasts = []
    const wx = {
      getRecorderManager() { return {} },
      cloud: { callFunction(options) { requests.push(options) } },
      showToast(options) { toasts.push(options) }
    }
    const source = fs.readFileSync(path.join(root, 'pages', name, `${name}.js`), 'utf8')
    vm.runInNewContext(source, {
      Page(page) { definition = page },
      wx,
      require(moduleName) {
        if (moduleName.endsWith('order-request')) return { createRequestId: () => 'message_test_request_0001' }
        if (moduleName.endsWith('protected-file')) return { download() {} }
        throw new Error(`Unexpected module: ${moduleName}`)
      }
    })
    const page = {
      ...definition,
      data: { ...definition.data, conversationId: 'order_example', inputText: '请核对我的教案' },
      setData(update) { Object.assign(this.data, update) }
    }
    if (name === 'chat') page.sendMsg()
    else page.sendText()

    if (name === 'chat') page.sendMsg()
    else page.sendText()

    assert.equal(requests.length, 1, 'rapid second tap must not create a new request ID')
    assert.equal(requests[0].name, 'sendMessage')
    assert.equal((name === 'chat' ? page.data.messages : page.data.replies).length, 0)
    assert.equal(toasts.length, 0)
    assert.equal(page.data.inputText, '请核对我的教案')

    requests[0].success({ result: { code: -3, error: '无权访问此会话' } })
    assert.equal((name === 'chat' ? page.data.messages : page.data.replies).length, 0)
    assert.equal(page.data.inputText, '请核对我的教案')
    assert.equal(toasts.at(-1).icon, 'none')
  }
})

test('student order page reports load failures and cannot claim an unsent reminder', () => {
  let definition
  let request
  const notices = []
  const source = fs.readFileSync(path.join(root, 'pages/order/order.js'), 'utf8')
  vm.runInNewContext(source, {
    Page(page) { definition = page },
    require() { return { download() {} } },
    wx: {
      cloud: { callFunction(options) { request = options } },
      showToast(options) { notices.push(options) },
      showModal(options) { notices.push(options) }
    }
  })
  const page = {
    ...definition,
    data: { ...definition.data },
    setData(update, callback) {
      Object.assign(this.data, update)
      if (callback) callback()
    }
  }
  page.loadOrders()
  request.success({ result: { code: -1, error: '服务不可用' } })
  assert.equal(page.data.loadError, true)
  assert.equal(page.data.orders.length, 0)
  assert.equal(notices.at(-1).icon, 'none')
  page.remindOrder()
  assert.match(notices.at(-1).content, /没有发送提醒/)
})

test('slow message reads stay active instead of being invalidated by the next poll', () => {
  for (const name of ['chat', 'teacher-reply']) {
    let definition
    const requests = []
    const source = fs.readFileSync(path.join(root, 'pages', name, `${name}.js`), 'utf8')
    vm.runInNewContext(source, {
      Page(page) { definition = page },
      wx: {
        getRecorderManager() { return {} },
        cloud: { callFunction(options) { requests.push(options) } }
      },
      require(moduleName) {
        if (moduleName.endsWith('order-request')) return { createRequestId: () => 'message_test_request_0002' }
        return { download() {} }
      }
    })
    const page = {
      ...definition,
      data: { ...definition.data, conversationId: 'order_example' },
      setData(update) { Object.assign(this.data, update) }
    }
    page.loadMessages()
    page.loadMessages()
    assert.equal(requests.length, 1, 'a second poll should not invalidate the pending read')
    requests[0].success({ result: { code: 0, data: [{ _id: 'one', side: 'in', content: '云端消息' }] } })
    assert.equal((name === 'chat' ? page.data.messages : page.data.replies).length, 1)
    page.loadMessages()
    assert.equal(requests.length, 2, 'the next poll is allowed after the pending read resolves')
  }
})
