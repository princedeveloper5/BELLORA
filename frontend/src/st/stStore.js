// BELLORA Student console store — the authenticated student's own data (read-only).
import { createStore } from '@/stores/createStore'
import api from '@/lib/api'

let toastSeq = 1

export const stStore = createStore({
  ready: false,
  error: '',
  overview: null,
  toasts: []
})

export const stActions = {
  toast(type, message, title) {
    const id = toastSeq++
    stStore.setState((state) => ({ toasts: [...state.toasts, { id, type, message, title }] }))
    setTimeout(() => {
      stStore.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4200)
  },

  success(message, title) {
    stActions.toast('success', message, title)
  },

  error(message, title) {
    stActions.toast('error', message, title)
  },

  async bootstrap({ force = false } = {}) {
    const state = stStore.getState()
    if (state.ready && !force) return
    try {
      const overview = await api.get('/student-console/overview', { showGlobalNotification: false }).then((r) => r.data)
      stStore.setState({ overview, error: '' })
    } catch (error) {
      stStore.setState({ error: error?.response?.data?.message || 'Could not load your student data.' })
    } finally {
      stStore.setState({ ready: true })
    }
  }
}
