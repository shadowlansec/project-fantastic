const RunStoryNode = require('../stories/runstorynode')
const {transaction} = require('../db')

const postStoryNode = async (user, res, req, query, stories) => {
  console.log(`postStoryNode: Received http request to run node ${query.node} from story ${query.story}`)
  const date = Date.now()
  const db = await transaction()
  // TODO: validate query
  // TODO: check if we completed previous node or current
  const result = await RunStoryNode(db, query.story, query.node, user, date)
  await db.insert('all_history', {event_type: 'story', event_id: result.event_id, date, user_id: user.user_id})
  await db.close()
  if (res.aborted) return
  res.end(JSON.stringify({result: result.results, rows: result.rows, date, success: result.success}))
  console.log(`postStoryNode: ran node ${query.node} from story ${query.story}, queried ${result.rows.length} nodes`)
}

module.exports = postStoryNode