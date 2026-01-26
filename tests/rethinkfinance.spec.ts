import { createApolloFetch } from 'apollo-fetch'
import { expect } from 'chai'

const DEFAULT_URL = 'http://localhost:8000/subgraphs/name/rethinkfinance'

describe('RethinkFinance subgraph (Mocha integration)', function () {
  this.timeout(30_000)

  const url = process.env.SUBGRAPH_URL || DEFAULT_URL
  const fetch = createApolloFetch({ uri: url })

  let reachable = false

  before(async function () {
    try {
      const res = await fetch({
        query: `
          query IntrospectionQuery { 
            __schema { queryType { name } } 
          }
        `,
      })
      if (res && !res.errors) {
        reachable = true
      }
    } catch (e) {
      // Endpoint is not reachable; mark suite as skipped
      this.skip()
    }
  })

  it('should respond to introspection without errors', async () => {
    if (!reachable) return
    const res = await fetch({
      query: `
        query IntrospectionQuery { 
          __schema { types { name } } 
        }
      `,
    })
    expect(res.errors, JSON.stringify(res.errors)).to.be.undefined
    expect(res.data.__schema.types.length).to.be.greaterThan(0)
  })
})
