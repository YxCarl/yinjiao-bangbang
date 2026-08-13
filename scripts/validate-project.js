const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const errors = []

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/')
}

function repositoryFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }
  )
  return output
    .split('\0')
    .filter(Boolean)
    .map(file => path.join(root, file))
    .filter(file => fs.existsSync(file) && fs.statSync(file).isFile())
}

function requireFile(file) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required file: ${file}`)
}

const requiredFiles = [
  'README.md',
  'README.zh-CN.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'GOVERNANCE.md',
  'CHANGELOG.md',
  'docs/ARCHITECTURE.md',
  'docs/DEPLOYMENT.md',
  'docs/ROADMAP.md',
  'docs/MENTOR_APPROVAL.md',
  'docs/TESTING.md',
  'docs/SECURITY_RULES.md',
  'security/database-rules.json',
  'security/storage-rules.json',
  '.github/workflows/validate.yml'
]
requiredFiles.forEach(requireFile)

// Validate repository inputs, including untracked files that would be added by
// Git, while excluding intentionally private or generated files from
// .gitignore (for example project.private.config.json).
const files = repositoryFiles()
for (const file of files.filter(file => file.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    errors.push(`Invalid JSON in ${relative(file)}: ${error.message}`)
  }
}

for (const file of files.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    errors.push(`JavaScript syntax error in ${relative(file)}: ${result.stderr.trim()}`)
  }
}

const secretPatterns = [
  { label: 'committed WeChat cloud environment ID', pattern: /cloud\d+-[a-z0-9]{10,}/i },
  { label: 'committed WeChat AppID', pattern: /wx[a-f0-9]{16}/i },
  { label: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
]

for (const file of files) {
  if (!/\.(?:js|json|md|yml|yaml|wxml|wxss|txt)$/i.test(file)) continue
  const text = fs.readFileSync(file, 'utf8')

  const trailingWhitespaceLine = text
    .split(/\r?\n/)
    .findIndex(line => /[ \t]+$/.test(line))
  if (trailingWhitespaceLine >= 0) {
    errors.push(`Trailing whitespace in ${relative(file)}:${trailingWhitespaceLine + 1}`)
  }

  if (relative(file) === 'scripts/validate-project.js') continue
  for (const rule of secretPatterns) {
    if (rule.pattern.test(text)) errors.push(`${rule.label} found in ${relative(file)}`)
  }
}

const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
if (projectConfig.appid !== 'touristappid') {
  errors.push('project.config.json must keep the public-safe touristappid value')
}

const cloudRoot = path.join(root, 'cloudfunctions')
const cloudFunctions = fs.readdirSync(cloudRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  // WeChat Developer Tools may materialize empty directories for functions
  // that exist only in the selected remote environment. They cannot be
  // committed and must not be treated as repository source directories.
  .filter(entry => fs.readdirSync(path.join(cloudRoot, entry.name)).length > 0)

for (const entry of cloudFunctions) {
  const functionRoot = path.join(cloudRoot, entry.name)
  for (const file of ['index.js', 'package.json', 'config.json']) {
    if (!fs.existsSync(path.join(functionRoot, file))) {
      errors.push(`Cloud Function ${entry.name} is missing ${file}`)
    }
  }

  const packagePath = path.join(functionRoot, 'package.json')
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    if (packageJson.license !== 'MIT') errors.push(`Cloud Function ${entry.name} must declare the MIT license`)
    if (packageJson.private !== true) errors.push(`Cloud Function ${entry.name} must be marked private`)
  }
}

try {
  execFileSync('git', ['diff', '--check'], { cwd: root, stdio: 'pipe' })
} catch (error) {
  errors.push(`git diff --check failed:\n${error.stdout || error.stderr || error.message}`)
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} problem(s):`)
  errors.forEach(error => console.error(`- ${error}`))
  process.exit(1)
}

const pageCount = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).pages.length
const functionCount = cloudFunctions.length
console.log(`Validation passed: ${pageCount} pages, ${functionCount} Cloud Functions, ${files.length} files checked.`)
