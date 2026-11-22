// BELLORA Teacher console store — the authenticated teacher's own data only.
import { createStore } from '@/stores/createStore'
import api from '@/lib/api'

let toastSeq = 1

export const tcStore = createStore({
  ready: false,
  overview: null,
  error: '',
  toasts: []
})

export const tcActions = {
  toast(type, message, title) {
    const id = toastSeq++
    tcStore.setState((state) => ({ toasts: [...state.toasts, { id, type, message, title }] }))
    setTimeout(() => {
      tcStore.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4200)
  },

  success(message, title) {
    tcActions.toast('success', message, title)
  },

  error(message, title) {
    tcActions.toast('error', message, title)
  },

  async bootstrap() {
    if (tcStore.getState().ready) return
    try {
      const overview = await api.get('/teacher-console/overview').then((r) => r.data)
      tcStore.setState({ overview, error: '' })
    } catch (error) {
      tcActions.error(error?.response?.data?.message || 'Could not load your dashboard data', 'Error')
    } finally {
      tcStore.setState({ ready: true })
    }
  }
}
