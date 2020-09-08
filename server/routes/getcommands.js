const GetPackagedData = require('../util/getpackageddata')
const ValidateRole = require('./auth/validaterole')
const Abort = require('./abort')

const getCommands = (res, req, commands) => {
  console.log('getCommands: received http request to get command settings...')
  Abort(res)
  ValidateRole(req.getHeader('cookie'), 'user')
  .then(async valid => {
    if (!valid) return !res.aborted && res.end()
    const command_data = await Promise.all(Object.entries(commands)
      .map(v => GetPackagedData(v[0], 'commands').then(c => ({...c, key: v[0], mode: v[1]})))
    ) // TODO: filter out invalid scripts and warn the user
    .then(commands => commands.reduce((result, v) => ({ 
      ...result, 
      [v.key]: {name: v.name, description: v.description, hosts: v.hosts, mode: v.mode, role: v.role, command: v.run.command}
    }), {}))
    console.log(`getCommands: sent metadata for ${Object.keys(command_data).length} commands.`)

    res.end(JSON.stringify(command_data))
  })

}

module.exports = getCommands