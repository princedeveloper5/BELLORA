import { createStore } from './createStore'

export const loadingStore = createStore({
  visible: false,
  bootLoading: false,
  routeLoading: false,
  pendingRequests: 0,
  hideTimer: null
})

export const loadingActions = {
  show() {
    const { hideTimer } = loadingStore.getState()
    if (hideTimer) {
      clearTimeout(hideTimer)
      loadingStore.setState({ hideTimer: null })
    }
    loadingStore.setState({ visible: true })
  },

  scheduleHide(delay = 520) {
    const { bootLoading, routeLoading, pendingRequests } = loadingStore.getState()
    if (bootLoading || routeLoading || pendingRequests > 0) return

    const { hideTimer } = loadingStore.getState()
    if (hideTimer) clearTimeout(hideTimer)

    const timer = setTimeout(() => {
      loadingStore.setState({ visible: false, hideTimer: null })
    }, delay)

    loadingStore.setState({ hideTimer: timer })
  },

  startBoot() {
    loadingStore.setState({ bootLoading: true })
    loadingActions.show()
  },

  finishBoot() {
    loadingStore.setState({ bootLoading: false })
    loadingActions.scheduleHide(650)
  },

  startRoute() {
    loadingStore.setState({ routeLoading: true })
    loadingActions.show()
  },

  finishRoute() {
    loadingStore.setState({ routeLoading: false })
    loadingActions.scheduleHide()
  },

  startRequest() {
    loadingStore.setState((state) => ({ pendingRequests: state.pendingRequests + 1 }))
    loadingActions.show()
  },

  finishRequest() {
    loadingStore.setState((state) => ({ pendingRequests: Math.max(state.pendingRequests - 1, 0) }))
    loadingActions.scheduleHide()
  }
}

import { useStore as _useStoreImpl } from './useStore'
export const useLoadingStore = () => {
  const state = _useStoreImpl(loadingStore)
  return {
    ...state,
    isLoading: state.visible,
    isBlockingLoading: state.visible && (state.bootLoading || state.routeLoading),
    isRequestLoading: state.pendingRequests > 0,
    show: loadingActions.show,
    scheduleHide: loadingActions.scheduleHide,
    startBoot: loadingActions.startBoot,
    finishBoot: loadingActions.finishBoot,
    startRoute: loadingActions.startRoute,
    finishRoute: loadingActions.finishRoute,
    startRequest: loadingActions.startRequest,
    finishRequest: loadingActions.finishRequest
  }
}
