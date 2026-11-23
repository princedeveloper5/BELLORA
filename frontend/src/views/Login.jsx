import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, ChartNoAxesCombined, Eye, EyeOff, LockKeyhole, Moon, Sparkles, Sun, UserRound, UsersRound } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { applyThemeClass, readThemePreference } from '@/utils/theme'
import './Login.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const authStore = useAuthStore()
  const [isDarkMode, setIsDarkMode] = useState(() => readThemePreference('adminDarkMode'))

  const [rememberMe, setRememberMe] = useState(true)

  const [form, setForm] = useState({
    email: '',
    password: ''
  })

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    const authError = new URLSearchParams(location.search).get('auth_error')
    return authError ? String(authError) : ''
  })
  const [success, setSuccess] = useState('')

  const toggleTheme = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    applyThemeClass('admin-dark-mode', next)
    localStorage.setItem('adminDarkMode', String(next))
  }

  const emailError = (() => {
    const value = form.email.trim()
    if (!value) return ''
    if (!emailPattern.test(value)) return 'Invalid email address.'
    return ''
  })()

  const passwordError = (() => {
    const value = form.password
    if (!value) return ''
    if (value.length < 6) return 'Password must be at least 6 characters.'
    return ''
  })()

  const validate = () => {
    setError('')
    setSuccess('')

    if (emailError) {
      setError(emailError)
      return false
    }
    if (passwordError) {
      setError(passwordError)
      return false
    }
    if (!form.email.trim()) {
      setError('Email is required.')
      return false
    }
    if (!form.password) {
      setError('Password is required.')
      return false
    }
    return true
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setLoading(true)
    setError('')
    setSuccess('')

    let result = null
    try {
      const payload = { ...form, rememberMe }
      result = await authStore.login(payload)
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Login failed. Please try again.')
      setLoading(false)
      return
    }

    if (result?.success) {
      setSuccess('Login successful. Redirecting...')

      const userType = result.userType || result.user?.role
      if (userType === 'teacher') {
        await navigate('/teacher/dashboard')
      } else if (userType === 'student') {
        await navigate('/student/dashboard')
      } else {
        await navigate(result.redirectTo || '/dashboard')
      }
      setLoading(false)
      return
    }

    setError(result?.error || 'Incorrect credentials. Please try again.')
    setLoading(false)
  }

  return (
    <div className={`login-page min-vh-100 d-flex align-items-center justify-content-center p-3${isDarkMode ? ' login-page--dark' : ''}`}>
      <button
        type="button"
        className="login-theme-toggle"
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
      >
        {isDarkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
      </button>

      <section className="login-hero" aria-label="BELLORA overview">
        <div className="login-brand">
          <img
            className="hero-brand-lockup"
            src={`${import.meta.env.BASE_URL}bellora-brand-lockup.png`}
            alt="BELLORA — Smarter Scheduling, Better Learning"
          />
        </div>

        <div className="hero-copy">
          <p className="hero-kicker">A clearer way to run your school.</p>
          <p>BELLORA helps schools manage timetables, users, classes and academic activities efficiently — all in one place.</p>
        </div>

        <div className="hero-features" aria-label="Platform benefits">
          <div><CalendarDays size={19} /><span>Manage<br />Timetables</span></div>
          <div><UsersRound size={19} /><span>Assign<br />Classes</span></div>
          <div><ChartNoAxesCombined size={19} /><span>Track<br />Progress</span></div>
          <div><Sparkles size={19} /><span>Improve<br />Efficiency</span></div>
        </div>
      </section>

      <div className={`login-card w-100${loading ? ' is-loading' : ''}`}>
        <div className="login-card-header">
          <div>
            <h1 className="auth-title mb-0">Welcome Back</h1>
            <p>Sign in to your BELLORA account</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label htmlFor="email" className="form-label">Email Address</label>
            <div className="login-input-wrap">
              <UserRound className="login-input-icon" size={22} strokeWidth={2.25} aria-hidden="true" />
              <input
                id="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
                required
                className={`form-control${emailError ? ' is-invalid' : ''}`}
                placeholder="Enter your email"
                autoComplete="username"
              />
            </div>
            {emailError ? (
              <div className="invalid-feedback d-block mt-1">
                {emailError}
              </div>
            ) : null}
          </div>

          <div className="login-field">
            <label htmlFor="password" className="form-label">Password</label>

            <div className="login-input-wrap">
              <LockKeyhole className="login-input-icon" size={22} strokeWidth={2.25} aria-hidden="true" />
              <input
                id="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                type={showPassword ? 'text' : 'password'}
                required
                className={`form-control${passwordError ? ' is-invalid' : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={20} strokeWidth={2.2} aria-hidden="true" />}
              </button>
            </div>

            {passwordError ? (
              <div className="invalid-feedback d-block mt-1">
                {passwordError}
              </div>
            ) : null}
          </div>

          <div className="login-options">
            <label className="d-flex align-items-center gap-2 mb-0 remember-row">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="remember-check" />
              <span>Remember Me</span>
            </label>

            <Link to="/forgot-password" className="forgot-link">
              Forgot Password?
            </Link>
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary-custom login-submit w-100"
          >
            {loading ? (
              <span className="d-flex align-items-center justify-content-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Signing in...
              </span>
            ) : (
              <span>Login&nbsp; →</span>
            )}
          </button>

          {success ? (
            <div className="text-success small fw-semibold mt-2 text-center">
              {success}
            </div>
          ) : null}

          <Link to="/register" className="create-account-button">
            Register
          </Link>
        </form>
      </div>
    </div>
  )
}
