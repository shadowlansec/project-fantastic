export default (state, key) => state.flex_search[key].query && state.flex_search[key].results ? state.flex_search[key].results.reduce((r, v) => ({...r, [v.id]: state[key][v.id]}), {}) : state[key]