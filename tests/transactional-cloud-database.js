// Deterministic document-store double for executing the REAL adapter callbacks.
// It serializes transactions and stages writes; it does not emulate CloudBase locks.
function clone(value) { return JSON.parse(JSON.stringify(value)) }

class TransactionalCloudDatabase {
  constructor(readState, commitState, clock) {
    this.readState = readState
    this.commitState = commitState
    this.clock = clock
    this.queue = Promise.resolve()
    this.failOnWrite = 0
    this.beforeTransaction = null
  }

  serverDate() { return this.clock() }

  collection(name) {
    return this.reference(name, () => this.readState(), false)
  }

  reference(name, state, inTransaction, recordWrite = () => {}) {
    return {
      where: filter => {
        if (inTransaction) throw new Error('Transactions cannot query with where')
        let maximum = 100
        const query = {
          limit(value) { maximum = value; return query },
          async get() {
            return { data: clone((state()[name] || []).filter(row => (
              Object.entries(filter).every(([key, value]) => row[key] === value)
            )).slice(0, maximum)) }
          }
        }
        return query
      },
      doc: id => ({
        async get() {
          return { data: clone((state()[name] || []).find(row => row._id === id) || null) }
        },
        async set({ data }) {
          if (!inTransaction) throw new Error('Test requires transactional writes')
          recordWrite()
          const rows = state()[name] || (state()[name] = [])
          const index = rows.findIndex(row => row._id === id)
          const document = { ...clone(data), _id: id }
          if (index < 0) rows.push(document)
          else rows[index] = document
        },
        async update({ data }) {
          if (!inTransaction) throw new Error('Test requires transactional writes')
          recordWrite()
          const row = (state()[name] || []).find(row => row._id === id)
          if (!row) throw new Error('Cannot update absent document')
          Object.assign(row, clone(data))
        }
      })
    }
  }

  async runTransaction(callback) {
    const previous = this.queue
    let release
    this.queue = new Promise(resolve => { release = resolve })
    await previous
    try {
      if (this.beforeTransaction) {
        const hook = this.beforeTransaction
        this.beforeTransaction = null
        hook()
      }
      const staged = clone(this.readState())
      let writes = 0
      const recordWrite = () => {
        writes += 1
        if (writes === this.failOnWrite) {
          const error = new Error('Injected transactional write failure')
          error.code = 'TEST_WRITE_FAILURE'
          throw error
        }
      }
      const value = await callback({
        collection: name => this.reference(name, () => staged, true, recordWrite)
      })
      this.commitState(staged)
      return { result: value }
    } finally { release() }
  }
}

module.exports = { TransactionalCloudDatabase }
