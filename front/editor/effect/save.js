const FS = require('fs-extra')

export default (state, action, send) => {
  const {jsplumb: instance, nodes} = state.editor
  const elements = instance.getManagedElements()
  const json = Object.entries(elements).reduce((result, e) => ({...result, [e[0]]: {
    key: nodes[e[0]].key,
    type: nodes[e[0]].type,
    customDescription: nodes[e[0]].customDescription,
    position: {
      x: parseInt(e[1].el.style.left.replace('px', '')),
      y: parseInt(e[1].el.style.top.replace('px', ''))
    },
    targets: instance.getConnections({source: e[0]}).map(c => c.targetId)
  }}), {})
  FS.writeJSON(action.path, json, {spaces: '\t'})
}