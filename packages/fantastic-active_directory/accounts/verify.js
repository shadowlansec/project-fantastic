const {get} = require('../db')
const GetRole = require('./getrole')

const verify = async session_id => {
  if (!session_id) return
  const user = await get({table: 'users', columns: ['user_id', 'username'], conditions: {columns: {session_id}}})
  if (!user) return
  const role = await GetRole(user.username)
  return {...user, role}
}

module.exports = verify