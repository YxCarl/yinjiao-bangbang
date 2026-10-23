const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')

function validateSecurityPolicy(pkg, lock) {
  const expected = { '@cloudbase/node-sdk': { axios: '0.34.0', '@cloudbase/database': '1.5.1' } }
  if (JSON.stringify(pkg.overrides) !== JSON.stringify(expected)) {
    throw new Error('Cloud SDK security overrides differ from the reviewed policy')
  }
  // A lockfile does not record root overrides. Verify actual resolved versions,
  // including nested copies, so removing/ignoring an override cannot pass offline.
  for (const [name, version] of Object.entries({
    'wx-server-sdk': '4.0.2', '@cloudbase/node-sdk': '3.17.2',
    axios: '0.34.0', '@cloudbase/database': '1.5.1'
  })) {
    const entries = Object.entries(lock.packages).filter(([key]) =>
      key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`))
    if (!entries.length || entries.some(([, value]) => value.version !== version)) {
      throw new Error(`Cloud SDK security lock mismatch: ${name}`)
    }
  }
}

function lockFingerprint(pkg, lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) throw new Error('Expected npm lockfile v3')
  if (lock.name !== pkg.name || lock.version !== pkg.version) throw new Error('Lockfile package identity mismatch')
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'overrides']) {
    const expected = pkg[field] || {}
    const actual = lock.packages[''][field] || {}
    // npm does not repeat overrides in the root package entry.
    if (field !== 'overrides' && JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Lockfile ${field} drift`)
  }
  const tree = Object.entries(lock.packages).filter(([key]) => key).sort(([a], [b]) => a.localeCompare(b))
  for (const [key, value] of tree) {
    if (!key.startsWith('node_modules/') || value.link || !value.integrity ||
        typeof value.resolved !== 'string' || !value.resolved.startsWith('https://registry.npmjs.org/')) {
      throw new Error(`Dependency lock must use integrity-checked public npm packages, not local links: ${key}`)
    }
  }
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    if (/^\d+\.\d+\.\d+$/.test(version) && lock.packages[`node_modules/${name}`]?.version !== version) {
      throw new Error(`Locked direct dependency differs: ${name}`)
    }
  }
  return createHash('sha256').update(JSON.stringify({ tree, overrides: pkg.overrides || {} })).digest('hex')
}

function dependencyGroups(projectRoot = root) {
  const cloudRoot = path.join(projectRoot, 'cloudfunctions')
  const groups = new Map()
  const directories = fs.readdirSync(cloudRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.readdirSync(path.join(cloudRoot, entry.name)).length)
    .sort((a, b) => a.name.localeCompare(b.name))
  if (!directories.length) throw new Error('No Cloud Function packages found')
  for (const entry of directories) {
    const directory = path.join(cloudRoot, entry.name)
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
    const lock = JSON.parse(fs.readFileSync(path.join(directory, 'package-lock.json'), 'utf8'))
    const fingerprint = lockFingerprint(pkg, lock)
    validateSecurityPolicy(pkg, lock)
    if (!groups.has(fingerprint)) groups.set(fingerprint, { fingerprint, directory, functions: [] })
    groups.get(fingerprint).functions.push(entry.name)
  }
  return [...groups.values()]
}

function auditOutcome(result) {
  if (result.error || ![0, 1].includes(result.status)) return { status: 'unavailable' }
  try {
    const report = JSON.parse(result.stdout)
    const counts = report.metadata && report.metadata.vulnerabilities
    if (report.error || !counts || ['low', 'moderate', 'high', 'critical', 'total'].some(key =>
      !Number.isInteger(counts[key]) || counts[key] < 0)) return { status: 'unavailable' }
    // Never turn a failing audit or an invalid response into a green check.
    const failed = result.status !== 0 || counts.high > 0 || counts.critical > 0
    const packages = Object.entries(report.vulnerabilities || {}).map(([name, item]) => ({
      name, severity: item.severity,
      advisories: (item.via || []).filter(value => typeof value === 'object').map(value => value.url)
    }))
    return { status: failed ? 'vulnerable' : 'passed', counts, packages }
  } catch (_) { return { status: 'unavailable' } }
}

function main() {
  const groups = dependencyGroups()
  const count = groups.reduce((sum, group) => sum + group.functions.length, 0)
  console.log(`Validated ${count} Cloud Function locks; ${groups.length} distinct dependency tree(s).`)
  if (process.argv.includes('--check')) return
  const npmCli = process.env.npm_execpath
  if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Run through npm run audit:cloud')
  const cache = path.join(root, 'outputs', 'npm-cache')
  let failed = false
  for (const group of groups) {
    const result = spawnSync(process.execPath, [npmCli, 'audit', '--omit=dev', '--package-lock-only',
      '--audit-level=high', '--json', '--registry=https://registry.npmjs.org', '--cache', cache], {
      cwd: group.directory, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024
    })
    const outcome = auditOutcome(result)
    console.log(JSON.stringify({ functions: group.functions, fingerprint: group.fingerprint, ...outcome }))
    if (outcome.status !== 'passed') failed = true
  }
  if (failed) process.exitCode = 1
}

if (require.main === module) {
  try { main() } catch (error) {
    console.error('Dependency audit incomplete:', error.message)
    process.exitCode = 1
  }
}

module.exports = { lockFingerprint, dependencyGroups, auditOutcome, validateSecurityPolicy }
