const systemPrefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

export const readThemePreference = (storageKey) => {
  const savedValue = localStorage.getItem(storageKey)
  return savedValue === null ? systemPrefersDark() : savedValue === 'true'
}

export const applyThemeClass = (className, enabled) => {
  document.body.classList.toggle(className, enabled)
  document.documentElement.style.colorScheme = enabled ? 'dark' : 'light'
}

// Use the operating-system preference until the user chooses a theme in the app.
export const initializeTheme = (className, storageKey) => {
  applyThemeClass(className, readThemePreference(storageKey))

  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
  const syncSystemTheme = (event) => {
    if (localStorage.getItem(storageKey) === null) applyThemeClass(className, event.matches)
  }
  mediaQuery?.addEventListener('change', syncSystemTheme)

  return () => mediaQuery?.removeEventListener('change', syncSystemTheme)
}
