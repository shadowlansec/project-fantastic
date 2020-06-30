const GetAsset = require('../util/getpackageddata')
const Abort = require('./abort')
const Auth = require('./auth')
const HasRole = require('fantastic-utils/hasrole')

const getTests = (res, req, tests) => {
  Abort(res)
  console.log('getTests: received http request to get available tests...')
  Auth(req.getHeader('cookie'))
  .then(async user => {
    if (!user) return !res.aborted && res.end()
    const test_data = await Promise.all(tests
      .map(v => GetAsset(v).then(t => ({...t, key:v})))
    )
    .then(tests => tests      
      .filter(v => HasRole(user, v.role))
      .reduce((result, v) => ({ 
        ...result, 
        [v.key]: {name: v.name, description: v.description, hosts: v.hosts, pass: v.pass, parameters: v.parameters}
      }), {})
    )
    console.log(`getTests: sent metadata for ${Object.keys(test_data).length} tests.`)
    res.end(JSON.stringify(test_data))
  })
}

module.exports = getTests