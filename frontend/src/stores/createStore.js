export function createStore(initialState) {
  let state = initialState
  const listeners = new Set()

  const getState = () => state

  const setState = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    if (!next) return
    state = { ...state, ...next }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { getState, setState, subscribe }
}
