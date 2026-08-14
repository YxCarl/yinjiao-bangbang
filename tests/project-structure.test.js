const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('every configured page has the four Mini Program source files', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.ok(app.pages.length >= 20, 'expected the documented multi-page application')

  for (const page of app.pages) {
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      assert.ok(fs.existsSync(path.join(root, page + extension)), `${page + extension} is missing`)
    }
  }
})

test('every Cloud Function has code, configuration, and the pinned SDK', () => {
  const cloudRoot = path.join(root, 'cloudfunctions')
  const functions = fs.readdirSync(cloudRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    // WeChat Developer Tools may create empty placeholders for remote-only
    // functions. Empty directories cannot be committed, so they are not part
    // of the repository structure under test.
    .filter(entry => fs.readdirSync(path.join(cloudRoot, entry.name)).length > 0)
  assert.ok(functions.length >= 10, 'expected the documented Cloud Functions')

  for (const entry of functions) {
    const functionRoot = path.join(cloudRoot, entry.name)
    for (const file of ['index.js', 'config.json', 'package.json']) {
      assert.ok(fs.existsSync(path.join(functionRoot, file)), `${entry.name}/${file} is missing`)
    }
    const packageJson = JSON.parse(fs.readFileSync(path.join(functionRoot, 'package.json'), 'utf8'))
    assert.equal(packageJson.private, true, `${entry.name} must be private`)
    assert.equal(packageJson.license, 'MIT', `${entry.name} must use MIT`)
    assert.equal(
      packageJson.dependencies['wx-server-sdk'],
      '3.0.4',
      `${entry.name} must use the repository SDK baseline`
    )
  }
})

test('the public project configuration contains no deployment AppID', () => {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
  assert.equal(project.appid, 'touristappid')
  const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
  assert.doesNotMatch(appSource, /cloud\d+-[a-z0-9]{10,}/i)
})
