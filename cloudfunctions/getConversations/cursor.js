// Kept inside this function because CloudBase deploys function directories separately.
const crypto = require('crypto')

function scopeFor(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function encodeCursor(record, scope) {
  const time = new Date(record.lastTime).getTime()
  if (!Number.isSafeInteger(time) || typeof record._id !== 'string' || !record._id) {
    throw new Error('Invalid stored pagination key')
  }
  return Buffer.from(JSON.stringify({ v: 1, s: scopeFor(scope), t: time, id: record._id })).toString('base64')
}

function decodeCursor(value, scope) {
  if (value === undefined || value === '') return null
  if (typeof value !== 'string' || value.length > 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Invalid cursor')
  }
  const cursor = JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
  if (!cursor || cursor.v !== 1 || cursor.s !== scopeFor(scope) ||
      !Number.isSafeInteger(cursor.t) || Math.abs(cursor.t) > 8640000000000000 ||
      typeof cursor.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(cursor.id)) {
    throw new Error('Invalid cursor')
  }
  return { time: cursor.t, id: cursor.id }
}

function pageSize(value) {
  if (value === undefined) return 50
  if (!Number.isInteger(value) || value < 1 || value > 50) throw new Error('Invalid page size')
  return value
}

module.exports = { encodeCursor, decodeCursor, pageSize }
