import { createStore } from './createStore'

export const authStore = createStore({
  user: null,
  token: null,
  userType: null,
  loading: false,
  error: null,
  lastAuthCheckedAt: 0
})

export const authActions = {
  async login(credentials, api) {
    authStore.setState({ loading: true, error: null })

    try {
      const response = await api.post('/auth/login', credentials)
      const { token } = response.data
      const user = response.data.user
      const loginType = user?.role || response.data.role || 'admin'

      authStore.setState({
        token,
        user,
        userType: loginType,
        lastAuthCheckedAt: Date.now()
      })

      localStorage.setItem('token', token)
      localStorage.setItem('userType', loginType)
      api.defaults.headers.common.Authorization = `Bearer ${token}`

      if (loginType === 'teacher') {
        localStorage.setItem('teacher', JSON.stringify(user))
        localStorage.removeItem('user')
      } else {
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.removeItem('teacher')
      }

      return { success: true, userType: loginType, user, redirectTo: response.data.redirectTo }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.errors?.[0]?.msg ||
        error?.response?.data?.errors?.[0]?.message ||
        'Login failed'
      authStore.setState({ error: message })
      return { success: false, error: message }
    } finally {
      authStore.setState({ loading: false })
    }
  },

  async register(userData, api) {
    authStore.setState({ loading: true, error: null })

    try {
      const response = await api.post('/auth/register', userData)
      if (response.status === 202) {
        return {
          success: true,
          requiresOtp: true,
          email: response.data.email,
          role: response.data.role,
          expiresInSeconds: response.data.expires_in_seconds,
          resendCooldownSeconds: response.data.resend_cooldown_seconds
        }
      }

      const { token, user } = response.data
      const userType = user?.role || response.data.role || userData.role || 'teacher'

      authStore.setState({
        token,
        user,
        userType,
        lastAuthCheckedAt: Date.now()
      })

      localStorage.setItem('token', token)
      localStorage.setItem('userType', userType)
      if (userType === 'teacher') {
        localStorage.setItem('teacher', JSON.stringify(user))
        localStorage.removeItem('user')
      } else {
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.removeItem('teacher')
      }
      api.defaults.headers.common.Authorization = `Bearer ${token}`

      return { success: true, userType, redirectTo: response.data.redirectTo }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed'
      authStore.setState({ error: message })
      return { success: false, error: message }
    } finally {
      authStore.setState({ loading: false })
    }
  },

  logout(api) {
    authStore.setState({
      user: null,
      token: null,
      userType: null,
      error: null,
      lastAuthCheckedAt: 0
    })

    localStorage.removeItem('token')
    localStorage.removeItem('userType')
    localStorage.removeItem('user')
    localStorage.removeItem('teacher')
    if (api) delete api.defaults.headers.common.Authorization
  },

  async updateProfile(profileData, api) {
    authStore.setState({ loading: true, error: null })

    try {
      const { userType } = authStore.getState()
      const endpoint = userType === 'teacher' ? '/teacher-auth/me' : '/auth/me'
      const token = authStore.getState().token || localStorage.getItem('token')
      const response = await api.put(endpoint, profileData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const user = userType === 'teacher' ? response.data.teacher : response.data.user

      authStore.setState({ user, lastAuthCheckedAt: Date.now() })

      if (userType === 'teacher') {
        localStorage.setItem('teacher', JSON.stringify(user))
      } else {
        localStorage.setItem('user', JSON.stringify(user))
      }

      return { success: true, user }
    } catch (error) {
      const message =
        error.response?.data?.errors?.[0]?.msg || error.response?.data?.message || 'Profile update failed'
      authStore.setState({ error: message })
      return { success: false, error: message }
    } finally {
      authStore.setState({ loading: false })
    }
  },

  async checkAuth(api, { force = false } = {}) {
    const { token: storeToken, userType: storeUserType } = authStore.getState()
    const token = storeToken || localStorage.getItem('token')
    const storedUserType = storeUserType || localStorage.getItem('userType')
    const userType =
      storedUserType ||
      (localStorage.getItem('teacher') ? 'teacher' : localStorage.getItem('user') ? 'admin' : null)
    const now = Date.now()
    const authCacheWindow = 60 * 1000

    if (!token) {
      authActions.logout(api)
      return false
    }

    if (!userType) {
      authActions.logout(api)
      return false
    }

    authStore.setState({ token, userType })
    api.defaults.headers.common.Authorization = `Bearer ${token}`

    const cachedUser = userType === 'teacher' ? localStorage.getItem('teacher') : localStorage.getItem('user')
    let cachedUserValue = null

    if (cachedUser) {
      try {
        cachedUserValue = JSON.parse(cachedUser)
        authStore.setState({ user: cachedUserValue })
      } catch {
        authStore.setState({ user: null })
      }
    }

    const { user, lastAuthCheckedAt } = authStore.getState()
    if (!force && user && lastAuthCheckedAt && now - lastAuthCheckedAt < authCacheWindow) {
      return true
    }

    try {
      if (userType === 'teacher') {
        const response = await api.get('/teacher-auth/me')
        const teacher = response.data.teacher
        authStore.setState({ user: teacher, lastAuthCheckedAt: Date.now() })
        localStorage.setItem('userType', 'teacher')
        localStorage.setItem('teacher', JSON.stringify(teacher))
        return true
      }

      const response = await api.get('/auth/me')
      const user = response.data.user

      if (!['super_admin', 'dos', 'student', 'admin'].includes(user?.role)) {
        authActions.logout(api)
        return false
      }

      authStore.setState({ user, userType: user.role, lastAuthCheckedAt: Date.now() })
      localStorage.setItem('userType', user.role)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.removeItem('teacher')
      return true
    } catch {
      authActions.logout(api)
      return false
    }
  }
}

// React hook accessor mirroring the legacy Pinia store surface
// (state + getters + actions) so ported views can be written 1:1.
import { useStore as _useStoreImpl } from './useStore'

const lazyApi = () => import('@/lib/api').then((m) => m.default)

export const useAuthStore = () => {
  const state = _useStoreImpl(authStore)

  return {
    ...state,
    isAuthenticated: !!state.token,
    isAdminAuthenticated: !!state.token && ['super_admin', 'dos', 'admin'].includes(state.userType),
    isTeacherAuthenticated: !!state.token && state.userType === 'teacher',
    currentUser: state.user,
    currentUserType: state.userType,
    login: (credentials) => lazyApi().then((api) => authActions.login(credentials, api)),
    register: (userData) => lazyApi().then((api) => authActions.register(userData, api)),
    logout: () => authActions.logout(),
    updateProfile: (profileData) => lazyApi().then((api) => authActions.updateProfile(profileData, api)),
    checkAuth: (options = {}) => lazyApi().then((api) => authActions.checkAuth(api, options))
  }
}
