const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { lockFingerprint, dependencyGroups, auditOutcome } = require('../scripts/audit-cloud-dependencies')

const root = path.resolve(__dirname, '..')
test('every Cloud Function has a matching public-registry lockfile and identical trees share one audit', () => {
  const groups = dependencyGroups()
  const names = groups.flatMap(group => group.functions)
  const expected = fs.readdirSync(path.join(root, 'cloudfunctions')).filter(name =>
    fs.existsSync(path.join(root, 'cloudfunctions', name, 'package.json')))
  assert.deepEqual(names.sort(), expected.sort())
  assert.equal(new Set(groups.map(group => group.fingerprint)).size, groups.length)
})

test('lock validation rejects manifest drift, local links and a wrong locked SDK', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/sendMessage/package.json'), 'utf8'))
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/sendMessage/package-lock.json'), 'utf8'))
  const mutate = fn => { const value = structuredClone(lock); fn(value); return value }
  assert.throws(() => lockFingerprint(pkg, mutate(value => { value.packages[''].dependencies = {} })), /drift/)
  assert.throws(() => lockFingerprint(pkg, mutate(value => { value.packages['node_modules/local'] = { link: true, resolved: '../..' } })), /local links/)
  assert.throws(() => lockFingerprint(pkg, mutate(value => { value.packages['node_modules/wx-server-sdk'].version = '0.0.0' })), /Locked direct dependency/)
})

test('audit distinguishes high severity, lower severity and unavailable results without hiding failures', () => {
  const result = (status, counts) => ({ status, stdout: JSON.stringify({ metadata: { vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0, total: 0, ...counts } } }) })
  assert.equal(auditOutcome(result(0)).status, 'passed')
  assert.equal(auditOutcome(result(0, { moderate: 1, total: 1 })).status, 'passed')
  assert.equal(auditOutcome(result(1, { high: 1, total: 1 })).status, 'vulnerable')
  assert.equal(auditOutcome(result(0, { critical: 1, total: 1 })).status, 'vulnerable')
  assert.equal(auditOutcome({ status: 0, stdout: 'not JSON' }).status, 'unavailable')
  assert.equal(auditOutcome({ status: 0, stdout: '{}' }).status, 'unavailable')
  assert.equal(auditOutcome({ status: 1, stdout: '{"error":{"code":"ENOTFOUND"}}' }).status, 'unavailable')
  assert.equal(auditOutcome({ error: new Error('timeout') }).status, 'unavailable')
})

test('maintenance workflows use supported test runtimes and never deploy or suppress audit failures', () => {
  const validate = fs.readFileSync(path.join(root, '.github/workflows/validate.yml'), 'utf8')
  assert.match(validate, /node: \[22, 24\]/)
  const audit = fs.readFileSync(path.join(root, '.github/workflows/dependency-audit.yml'), 'utf8')
  assert.match(audit, /npm run audit:cloud/)
  assert.match(audit, /workflow_dispatch:/)
  assert.doesNotMatch(audit, /continue-on-error|\|\| true|audit fix|secrets\.|deploy/)
  for (const source of [validate, audit]) {
    for (const line of source.split('\n').filter(line => line.includes('uses:'))) {
      assert.match(line, /uses: [\w/-]+@[a-f0-9]{40}/)
    }
  }
})
