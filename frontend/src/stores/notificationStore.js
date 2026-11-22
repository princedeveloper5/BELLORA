import { createStore } from './createStore'

let nextId = 1
const timers = new Map()

export const notificationStore = createStore({ items: [] })

export const notificationActions = {
  push(notification) {
    const id = nextId++
    const timeout = notification.timeout ?? 4200
    const item = {
      id,
      type: notification.type || 'info',
      title: notification.title || '',
      message: notification.message || '',
      timeout,
      progress: 1,
      complete: false
    }

    notificationStore.setState((state) => ({ items: [...state.items, item] }))

    const progressTimer = setInterval(() => {
      const current = notificationStore.getState().items.find((entry) => entry.id === id)
      if (!current) {
        clearInterval(progressTimer)
        timers.delete(id)
        return
      }

      current.progress = Math.min(100, current.progress + 4)

      if (current.progress >= 100) {
        current.complete = true
        clearInterval(progressTimer)

        if (timeout > 0) {
          const dismissTimer = setTimeout(() => notificationActions.remove(id), timeout)
          timers.set(id, dismissTimer)
        } else {
          timers.delete(id)
        }
      }

      notificationStore.setState((state) => ({ items: [...state.items] }))
    }, 32)

    timers.set(id, progressTimer)

    return id
  },

  success(message, title = 'Success') {
    return notificationActions.push({ type: 'success', title, message })
  },

  error(message, title = 'Error') {
    return notificationActions.push({ type: 'error', title, message, timeout: 5200 })
  },

  info(message, title = 'Info') {
    return notificationActions.push({ type: 'info', title, message })
  },

  warning(message, title = 'Warning') {
    return notificationActions.push({ type: 'warning', title, message })
  },

  remove(id) {
    const timer = timers.get(id)
    if (timer) {
      clearInterval(timer)
      clearTimeout(timer)
      timers.delete(id)
    }
    notificationStore.setState((state) => ({
      items: state.items.filter((item) => item.id !== id)
    }))
  }
}

import { useStore as _useStoreImpl } from './useStore'
export const useNotificationStore = () => {
  const state = _useStoreImpl(notificationStore)
  return {
    ...state,
    push: notificationActions.push,
    success: notificationActions.success,
    error: notificationActions.error,
    info: notificationActions.info,
    warning: notificationActions.warning,
    remove: notificationActions.remove
  }
}
