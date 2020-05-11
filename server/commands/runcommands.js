const {all, addConnections, updateNode, addNodes} = require('../db')
const RunPowerShell = require('fantastic-cli/runpowershell')
const FlatUnique = require('fantastic-utils/flatunique')
const DefaultIPs = require('fantastic-utils/defaultips')
const GetCommand = require('../util/getpackagedfunction')

const run_type = (commands, result_type, host, hostname) => commands[result_type] ?
  Promise.all(commands[result_type].filter(v => v.hosts.includes(host)).map(v => v.run(hostname))).then(FlatUnique) :
  Promise.resolve([])

const run_one_of_type = async (commands, result_type, host, hostname) => {
  if (!commands[result_type]) return ''
  const funcs = commands[result_type].filter(v => v.hosts.includes(host))
  for (const f of funcs) { // TODO: instead of just running in order we should establish a priority so we run the best commands first
    const result = await f.run(hostname)
    if (result) return result
  }
}

const remove_line_breaks = s => s && s.replace(/\r?\n|\r/g, '') // for some reason we end up with line breaks in some of the results, which can mess with commands

const get_node = async (commands, computer_name) => {
  const host = computer_name ? 'remote' : 'local' // if we didn't supply a computer name we're running this on the local machine
  const label = `${host} host${computer_name ? ` ${computer_name}` : ''}`
  console.log(`getting host data from ${label}...`)
  const ips = FlatUnique([...await run_type(commands, 'ip_addresses', host, computer_name), ...DefaultIPs])
  console.log(`got IP Addresses from ${label}.`)
  const macs = await run_type(commands, 'mac_addresses', host, computer_name)
  console.log(`got MAC Addresses from ${label}.`)
  const os = await run_one_of_type(commands, 'os', host, computer_name)
  console.log(`got OS from ${label}.`)
  const hostname = await run_one_of_type(commands, 'hostname', host, computer_name).then(remove_line_breaks)
  console.log(`got hostname from ${label}.`)
  console.log(`Got data from ${label}.`)
  return {ips, macs, os, hostname, important: true}
}

const create_commands = commands => 
  commands ? Promise.all(Object.entries(commands)
  .filter(v => v[1])
  .map(v => GetCommand(v[0]))) // TODO: filter out invalid scripts and warn the user
  .then(res => res.reduce((result, v) => {
    (result[v.result_type] = result[v.result_type] || []).push(v)
    return result
  }, {})) :
  Promise.resolve()

const run = async get_commands => {
  const commands = await create_commands(get_commands())
  if (!commands) return setTimeout(() => run(get_commands), 1000)
  const ids = await get_node(commands).then(res => addNodes([{...res, access: 'local'}], true)) // create the initial node belonging to the local host
  const local = ids[0]
  const loop = async () => {
    console.log('starting host data loop...')
    const commands = await create_commands(get_commands())
    const remote = []
    console.log('finding hosts on network...')
    const hosts = await run_type(commands, 'hosts', 'local')
    for (const host of hosts) {
      await updateNode(local, host.local)
      await addNodes(host.remote)
    }
    console.log('finished searching for hosts, finding hosts with remote access enabled...')
    const nodes = await all({table: 'nodes', conditions: {columns: {important: true}}}) // "important" nodes are ones belonging to our network
    await Promise.all(nodes.map(async v => {
      if (v.node_id === local) return // we only want remote nodes here
      const hostname = v.hostname
      if (!hostname) return
      const res = await RunPowerShell(`Test-WsMan ${hostname}`, false) // if Test-WsMan doesn't error it means we can run remote commands on this host             
      if (res) {
        remote.push({ id: v.node_id, hostname })
        updateNode(v.node_id, { access: 'remote' }, true)
      }    
    }))
    console.log(`found ${remote.length} hosts with remote access enabled.`)
    await Promise.all([
      run_type(commands, 'connections', 'local').then(res => addConnections(local, res)),
      get_node(commands).then(res => updateNode(local, res, true)),
      ...remote.map(v => [
        run_type(commands, 'connections', 'remote', v.hostname).then(res => addConnections(v.id, res, true)),
        get_node(commands, v.hostname).then(res => updateNode(v.id, res, true))
      ]).flat()
    ])
    loop ()
  }

  loop()
}

module.exports = run