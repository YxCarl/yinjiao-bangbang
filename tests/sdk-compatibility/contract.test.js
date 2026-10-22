// Real installed SDKs; only the CloudBase request boundary is replaced.
// This is NOT a cloud emulator or evidence of deployed rules/locking.
const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const http = require('node:http')
const https = require('node:https')
const { createRequire } = require('node:module')

const root = path.resolve(__dirname, '../..')
const functionRoot = path.join(root, 'cloudfunctions/sendMessage')
const sdkRequire = createRequire(path.join(functionRoot, 'package.json'))
// Missing dependencies intentionally fail: first run npm ci in sendMessage.
const sdkPath = sdkRequire.resolve('wx-server-sdk')
const cloud = sdkRequire('wx-server-sdk')
const nodeRequire = createRequire(sdkRequire.resolve('@cloudbase/node-sdk'))
const transport = nodeRequire('./utils/tcbapirequester')
const { EJSON } = createRequire(nodeRequire.resolve('@cloudbase/database'))('bson')

const originalRequest = transport.request
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
const originalFetch = global.fetch
const originalContext = { keys: process.env.WX_CONTEXT_KEYS, openid: process.env.WX_OPENID }
const blockNetwork = () => { throw new Error('External network forbidden in SDK contract tests') }
https.request = blockNetwork
global.fetch = blockNetwork
http.request = function (options, ...args) {
  const host = typeof options === 'string' ? new URL(options).hostname : options.hostname
  assert.equal(host, '127.0.0.1', 'only the synthetic loopback HTTP fixture is permitted')
  return originalHttpRequest.call(this, options, ...args)
}
let calls
let respond
beforeEach(() => {
  calls = []
  respond = () => { throw new Error('Unexpected CloudBase request') }
  transport.request = async input => {
    calls.push(input.params)
    return respond(input.params)
  }
  process.env.WX_CONTEXT_KEYS = 'WX_OPENID'
  process.env.WX_OPENID = 'synthetic-sdk-user'
  cloud.init({ env: 'sdk-contract-test' })
})
after(() => {
  transport.request = originalRequest
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  global.fetch = originalFetch
  for (const [key, value] of [['WX_CONTEXT_KEYS', originalContext.keys], ['WX_OPENID', originalContext.openid]]) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

const listResponse = docs => ({ data: { list: docs.map(doc => EJSON.stringify(doc)) } })
const decode = value => typeof value === 'string' ? EJSON.parse(value) : value

test('installed SDK and security overrides resolve to the reviewed versions', () => {
  assert.equal(sdkRequire('wx-server-sdk/package.json').version, '4.0.2')
  assert.equal(nodeRequire('@cloudbase/database/package.json').version, '1.5.1')
  assert.equal(nodeRequire('axios/package.json').version, '0.34.0')
  assert.equal(sdkRequire('@cloudbase/node-sdk/package.json').version, '3.17.2')
})

test('all 14 deployed entry points initialize with the real SDK and trusted context API', () => {
  let count = 0
  for (const name of fs.readdirSync(path.join(root, 'cloudfunctions'))) {
    const filename = path.join(root, 'cloudfunctions', name, 'index.js')
    if (!fs.existsSync(filename)) continue
    const localRequire = createRequire(filename)
    const mod = { exports: {} }
    // Only resolution is redirected to the one identical installed tree, not SDK behavior.
    const load = request => request === 'wx-server-sdk' ? sdkRequire(request) : localRequire(request)
    const wrapper = vm.runInThisContext(`(function(require, module, exports, __dirname, __filename) {\n${fs.readFileSync(filename, 'utf8')}\n})`, { filename })
    wrapper(load, mod, mod.exports, path.dirname(filename), filename)
    assert.equal(typeof mod.exports.main, 'function', name)
    count++
  }
  assert.equal(count, 14)
  assert.equal(cloud.getWXContext().OPENID, 'synthetic-sdk-user')
  delete process.env.WX_CONTEXT_KEYS
  assert.equal(cloud.getWXContext().OPENID, undefined)
  assert.equal(calls.length, 0)
  assert.ok(sdkPath.includes('wx-server-sdk'))
})

test('real message adapter preserves Date cursors, logical queries and ordered results', async () => {
  const time = new Date('2026-10-22T00:00:00.000Z')
  respond = () => listResponse([{ _id: 'message-2', createTime: time }])
  const db = cloud.database()
  const adapter = require('../../cloudfunctions/getMessages/cloud-database-adapter').createCloudDatabaseAdapter(db)
  const docs = await adapter.listMessages('order-synthetic', { cursor: { time: time.toISOString(), id: 'message-1' }, direction: 'after', limit: 51 })
  assert.equal(docs[0].createTime.getTime(), time.getTime())
  const query = decode(calls[0].query)
  assert.deepEqual(query, { $and: [{ conversationId: 'order-synthetic' }, { $or: [
    { createTime: { $gt: time } }, { createTime: time, _id: { $gt: 'message-1' } }
  ] }] })
  assert.equal(calls[0].limit, 51)
  assert.deepEqual(decode(calls[0].order), { createTime: 1, _id: 1 })
  assert.deepEqual(Object.keys(decode(calls[0].order)), ['createTime', '_id'])
})

test('document/query results retain null handling, update stats, delete stats and insert IDs', async () => {
  const db = cloud.database({ throwOnNotFound: false })
  respond = params => {
    if (params.action === 'database.getDocument') return listResponse([])
    if (params.action === 'database.modifyDocument') return { data: { updated: 1 } }
    if (params.action === 'database.removeDocument') return { data: { deleted: 1 } }
    if (params.action === 'database.insertDocument') return { data: { insertedIds: ['new-user'] } }
    throw new Error(params.action)
  }
  assert.equal((await db.collection('users').doc('missing').get()).data, null)
  await assert.rejects(cloud.database().collection('users').doc('missing').get())
  assert.equal((await db.collection('orders').where({ status: 1 }).update({ data: { status: 2, completeTime: db.serverDate() } })).stats.updated, 1)
  assert.equal((await db.collection('users').doc('user').update({ data: { name: 'Test' } })).stats.updated, 1)
  assert.equal((await db.collection('rateLimits').doc('expired').remove()).stats.removed, 1)
  assert.equal((await db.collection('users').add({ data: { name: 'Test' } }))._id, 'new-user')
})

test('real transaction wrapper serializes Date/serverDate/inc and preserves callback results', async () => {
  const db = cloud.database({ throwOnNotFound: false })
  respond = params => {
    if (params.action === 'database.startTransaction') return { transactionId: 'txn-test' }
    if (params.action === 'database.getDocument') return listResponse([])
    if (params.action === 'database.modifyDocument') return { data: { updated: 1 } }
    if (params.action === 'database.commitTransaction') return {}
    throw new Error(params.action)
  }
  const expiry = new Date('2026-10-23T00:00:00.000Z')
  const result = await db.runTransaction(async txn => {
    assert.equal((await txn.collection('messages').doc('missing').get()).data, null)
    await txn.collection('rateLimits').doc('rate').set({ data: { expiresAt: expiry, count: 1 } })
    await txn.collection('conversations').doc('peer').update({ data: { unread: db.command.inc(1), lastTime: db.serverDate() } })
    return { status: 'created' }
  })
  assert.deepEqual(result, { status: 'created' })
  const writes = calls.filter(call => call.action === 'database.modifyDocument')
  assert.equal(writes.length, 2)
  assert.ok(writes.every(call => call.transactionId === 'txn-test'))
  const rate = decode(writes[0].data)
  assert.equal(rate.expiresAt.getTime(), expiry.getTime())
  const peer = decode(writes[1].data)
  assert.equal(peer.$inc.unread, 1)
  assert.deepEqual(peer.$set.lastTime, { $tcb_server_date: { offset: 0 } })
  assert.equal(calls.at(-1).action, 'database.commitTransaction')
})

test('SDK retries a simulated commit conflict and aborts on application exceptions', async () => {
  const db = cloud.database({ throwOnNotFound: false })
  let commits = 0
  let runs = 0
  respond = params => {
    if (params.action === 'database.startTransaction') return { transactionId: `txn-${runs}` }
    if (params.action === 'database.commitTransaction' && ++commits === 1) return { code: 'DATABASE_TRANSACTION_CONFLICT' }
    return {}
  }
  assert.equal(await db.runTransaction(async () => ++runs), 2)
  assert.equal(runs, 2)
  calls = []
  const failure = new Error('synthetic application failure')
  await assert.rejects(db.runTransaction(async () => { throw failure }), error => error === failure)
  assert.deepEqual(calls.map(call => call.action), ['database.startTransaction', 'database.abortTransaction'])
})

test('real sendMessage adapter runs authorization and four writes through installed transaction SDK', async () => {
  const db = cloud.database({ throwOnNotFound: false })
  const adapter = require('../../cloudfunctions/sendMessage/cloud-database-adapter').createCloudDatabaseAdapter(db)
  const members = {
    sender: { _id: 'sender', _openid: 'student', conversationId: 'order_order-1' },
    peer: { _id: 'peer', _openid: 'teacher', conversationId: 'order_order-1' }
  }
  respond = params => {
    if (params.action === 'database.startTransaction') return { transactionId: 'message-txn' }
    if (params.action === 'database.commitTransaction') return {}
    if (params.action === 'database.modifyDocument') return { data: { updated: 1 } }
    if (params.action === 'database.getDocument') {
      const id = decode(params.query)._id
      const record = params.collectionName === 'conversations' ? members[id]
        : params.collectionName === 'orders' ? { _openid: 'student', teacherId: 'mentor-1' }
          : params.collectionName === 'users' ? { _openid: 'teacher', role: 'mentor', mentorStatus: 'approved' } : null
      return listResponse(record ? [record] : [])
    }
    throw new Error(params.action)
  }
  const input = { openid: 'student', membershipId: 'sender', conversationId: 'order_order-1',
    peerMembershipIds: ['peer'], messageId: 'message', rateLimitId: 'rate', requestId: 'request',
    windowStartMs: 1000, maximumMessages: 10, rateLimitExpiresAtMs: 60000,
    kind: 'text', content: 'test', fileID: '', dur: 0, preview: 'test' }
  assert.deepEqual(await adapter.commitMessage(input), { status: 'created' })
  assert.equal(calls.filter(call => call.action === 'database.modifyDocument').length, 4)
  calls = []
  members.sender._openid = 'revoked'
  assert.deepEqual(await adapter.commitMessage(input), { status: 'forbidden' })
  assert.equal(calls.filter(call => call.action === 'database.modifyDocument').length, 0)
})

test('temporary URL and deletion wrappers preserve file statuses including failures', async () => {
  const fileID = 'cloud://synthetic-test.bucket/test.txt'
  respond = params => {
    if (params.action === 'storage.batchGetDownloadUrl') return { data: { download_list: [
      { fileID, code: 'SUCCESS', tempFileURL: 'https://example.invalid/test', maxAge: 600 },
      { fileID: 'missing', code: 'STORAGE_FILE_NONEXIST' }
    ] } }
    if (params.action === 'storage.batchDeleteFile') return { data: { delete_list: [{ fileID, code: 'SUCCESS' }] } }
    throw new Error(params.action)
  }
  const urls = await cloud.getTempFileURL({ fileList: [fileID, 'missing'] })
  assert.equal(urls.fileList[0].status, 0)
  assert.equal(urls.fileList[0].tempFileURL, 'https://example.invalid/test')
  assert.notEqual(urls.fileList[1].status, 0)
  assert.equal(urls.fileList[1].tempFileURL, '')
  assert.equal((await cloud.deleteFile({ fileList: [fileID] })).fileList[0].status, 0)
  assert.deepEqual(calls[0].file_list, [{ fileid: fileID }, { fileid: 'missing' }])
})

test('CloudBase Axios bridge handles local JSON, HTTP failure, redirects and timeout', async t => {
  const { CloudBase } = nodeRequire('./cloudbase')
  const client = new CloudBase({ env: 'sdk-contract-test' }).requestClient
  const server = http.createServer((req, res) => {
    if (req.url === '/slow') return
    if (req.url === '/error') { res.writeHead(503); res.end('unavailable'); return }
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/ok' }); res.end(); return }
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ body: data, header: req.headers['x-test'] })) })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = `http://127.0.0.1:${server.address().port}`
  const config = { proxy: false, headers: { 'X-Test': 'synthetic' } }
  const result = await client.post({ ...config, url: base + '/ok', method: 'post', data: { ok: true } })
  assert.equal(result.data.header, 'synthetic')
  assert.deepEqual(JSON.parse(result.data.body), { ok: true })
  assert.equal((await client.get({ ...config, url: base + '/redirect' })).status, 200)
  await assert.rejects(client.get({ ...config, url: base + '/error' }), error => error.response.status === 503)
  await assert.rejects(client.get({ ...config, url: base + '/slow', timeout: 30 }), error => error.code === 'ECONNABORTED')
})
