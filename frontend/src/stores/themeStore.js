import { createStore } from './createStore'
import { applyThemeClass, readThemePreference } from '@/utils/theme'

export const themeStore = createStore({
  isDarkMode: readThemePreference('teacherDarkMode')
})

export const themeActions = {
  applyTheme() {
    const { isDarkMode } = themeStore.getState()
    applyThemeClass('teacher-dark-mode', isDarkMode)
    localStorage.setItem('teacherDarkMode', String(isDarkMode))
  },

  toggleTheme() {
    themeStore.setState((state) => ({ isDarkMode: !state.isDarkMode }))
    themeActions.applyTheme()
  }
}

import { useStore as _useStoreImpl } from './useStore'
export const useThemeStore = () => {
  const state = _useStoreImpl(themeStore)
  return {
    ...state,
    applyTheme: themeActions.applyTheme,
    toggleTheme: themeActions.toggleTheme
  }
}
