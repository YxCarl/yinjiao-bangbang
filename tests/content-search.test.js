const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { createGetContentsHandler } = require('../cloudfunctions/getContents/handler')

function contentHandler(contents) {
  return createGetContentsHandler({
    database: {
      async getById(id) { return contents.find(item => item._id === id) || null },
      async list(type, offset, limit) {
        return contents.filter(item => !type || item.type === type).slice(offset, offset + limit)
      }
    },
    logger: { error() {} }
  })
}

test('search reaches matching resources after the first 30 sorted entries', async () => {
  const contents = Array.from({ length: 65 }, (_, index) => ({
    _id: `content-${index}`,
    title: index === 43 ? '小学语文教案' : `resource ${index}`,
    type: 'doc',
    tags: []
  }))
  const result = await contentHandler(contents)({ keyword: '小学语文' })
  assert.equal(result.code, 0)
  assert.deepEqual(result.data.map(item => item._id), ['content-43'])
  assert.equal(result.limited, false)
})

test('search bounds scanning and reports a partial result without claiming a total', async () => {
  const contents = Array.from({ length: 330 }, (_, index) => ({
    _id: `content-${index}`,
    title: index === 315 ? 'target' : `resource ${index}`
  }))
  const result = await contentHandler(contents)({ keyword: 'target' })
  assert.deepEqual(result.data, [])
  assert.equal(result.limited, true)
})

test('search handles incomplete content fields and rejects malformed input', async () => {
  const handler = contentHandler([{ _id: 'one', tags: null, name: '语文导师' }])
  assert.equal((await handler({ keyword: '语文' })).data.length, 1)
  assert.equal((await handler({ keyword: {} })).code, -1)
  assert.equal((await handler(null)).code, 0)
})

test('late responses cannot overwrite the latest Mini Program search', () => {
  const source = fs.readFileSync(path.join(__dirname, '../pages/search/search.js'), 'utf8')
  const requests = []
  let pageDefinition
  const sandbox = {
    Page(definition) { pageDefinition = definition },
    wx: {
      showLoading() {}, hideLoading() {},
      getStorageSync() { return [] }, setStorageSync() {},
      cloud: { callFunction(options) { requests.push(options) } }
    }
  }
  vm.runInNewContext(source, sandbox)
  const page = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData(patch) { Object.assign(this.data, patch) }
  }

  page.performSearch('旧词')
  page.performSearch('新词')
  requests[1].success({ result: { code: 0, data: [{ title: 'new' }], limited: false } })
  requests[0].success({ result: { code: 0, data: [{ title: 'old' }], limited: false } })
  assert.equal(page.data.searchResults[0].title, 'new')

  page.clearInput()
  requests[0].fail()
  assert.equal(page.data.searchResults.length, 0)
  assert.equal(page.data.hasSearched, false)

  page.performSearch('再次搜索')
  page.onInput({ detail: { value: '正在输入' } })
  requests[2].success({ result: { code: 0, data: [{ title: 'stale' }] } })
  assert.equal(page.data.searchResults.length, 0)
})
