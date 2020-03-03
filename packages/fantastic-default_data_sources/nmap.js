const Shell = require('node-powershell')
const FS = require('fs').promises
const ParseXML = require('xml2js').parseStringPromise

const get_os = (ip, index) => nmap_to_obj(`-O ${ip} -p 445`, `nmapos${index}.xml`) // TODO: should we check port 22 as well?
  .then(res => {
    if (res.nmaprun.host && res.nmaprun.host.length) {
      const os = res.nmaprun.host[0].os
      if (os && os.length && os[0].osmatch && os[0].osmatch.length) return os[0].osmatch[0].$.name
    }
  })

const node = async (host, index) => {
  const get_address = type => {
    const address = host.address.find(v => v.$.addrtype == type)
    return address && address.$.addr
  }
  const get_vendor = () => {
    const address = host.address.find(v => v.$.addrtype == 'mac')
    return address && address.$.vendor
  }
  const ips = []
  const ipv4 = get_address('ipv4')
  if (ipv4) ips.push(ipv4)
  const ipv6 = get_address('ipv6')
  if (ipv6) ips.push(ipv6)
  const hostname = host.hostnames && host.hostnames[0].hostname ? host.hostnames[0].hostname[0].$.name : ''
  const mac = get_address('mac')
  return {
    ips,
    macs: mac ? [{mac, vendor: get_vendor()}] : null,
    hostname,
    os: ips.length ? await get_os(ips[0], index) : null,
    important: true,
    local: host.status[0].$.reason === 'localhost-response'
  }
}

const directory = 'nmap_xml'
const nmap_to_obj = async (command, filename) => {
  const ps = new Shell({
    executionPolicy: 'Bypass',
    noProfile: true
  })
  ps.addCommand(`nmap ${command} -oX ${directory}/${filename}`)
  const result = await FS.mkdir(directory)
  .then(() => ps.invoke(), () => ps.invoke()) // if mkdir failed we don't care because it just means we already made the directory
  .then(() => FS.readFile(`${directory}/${filename}`))
  .then(res => ParseXML(res))
  .catch(rej => console.log(`Getting nmap results failed: ${rej}`))
  ps.dispose()
  return result
}

const nmap = {
  hosts: ['local'],
  result_type: 'hosts',
  description: 'Performs a fast scan using nmap to detect hosts on the network',
  run: () => nmap_to_obj('-T4 -F 192.168.1.0/24', 'nmap.xml')
    .then(res => Promise.all(res.nmaprun.host.map(node)))
    .then(res => {
      const localIndex = res.findIndex(v => v.local)
      const local = res.splice(localIndex, 1)[0]
      return {local, remote: res}
    }) 
}

module.exports = nmap