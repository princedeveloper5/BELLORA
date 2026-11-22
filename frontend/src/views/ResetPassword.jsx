import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '@/stores/api'
import './ResetPassword.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const resetPassword = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/auth/reset-password', {
        email,
        code,
        password,
        confirmPassword
      })
      sessionStorage.removeItem('resetEmail')
      sessionStorage.removeItem('resetCode')
      setSuccess(response.data.message || 'Password reset successful.')
      setTimeout(() => navigate('/login'), 900)
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('resetEmail') || ''
    const storedCode = sessionStorage.getItem('resetCode') || ''
    setEmail(storedEmail)
    setCode(storedCode)
    if (!storedEmail || !storedCode) {
      setError('Reset session not found. Please request a new OTP.')
    }
  }, [])

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3 reset-page"
      style={{ background: 'linear-gradient(135deg, #12304a 0%, #0f9d8a 100%)' }}
    >
      <div className="bg-white rounded-3 shadow-lg w-100" style={{ maxWidth: 450 }}>
        {/* Header */}
        <div className="text-center mb-4 p-4 pb-3">
          <div
            className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-2 brand-login-mark"
            style={{ width: 64, height: 64, background: '#e7f5f2', border: '1px solid rgba(15, 157, 138, .18)' }}
          >
            <img className="brand-login-logo" src={`${import.meta.env.BASE_URL}bellora-logo.svg`} alt="BELLORA logo" />
          </div>

          <h1 className="h3 fw-bold text-dark mb-1">Reset Password</h1>

          <div className="mt-2 d-flex align-items-center justify-content-center gap-2 secure-row">
            <span className="secure-lock" aria-hidden="true">🔐</span>
            <span className="text-muted small fw-semibold">Secure Password Reset</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={resetPassword} className="px-4 pb-4">
          <div className="alert alert-info d-flex align-items-center gap-2 mb-3">
            <span>✓</span>
            <div>
              <strong>Email verified</strong>
              <br />
              <small>{email || 'your account'}</small>
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label fw-medium">New Password</label>
            <div className="input-group">
              <input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                required
                className="form-control form-control-lg"
              />
              <button
                type="button"
                className="btn btn-outline-secondary password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2.2} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label fw-medium">Confirm Password</label>
            <div className="input-group">
              <input
                id="confirmPassword"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                required
                className="form-control form-control-lg"
              />
              <button
                type="button"
                className="btn btn-outline-secondary password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? <EyeOff size={18} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2.2} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          {/* Success Message */}
          {success ? (
            <div className="alert alert-success" role="alert">
              {success}
            </div>
          ) : null}

          {/* Submit Button */}
          <button type="submit" disabled={loading || !email || !code} className="btn btn-primary-custom btn-lg w-100 fw-semibold">
            {loading ? (
              <span className="d-flex align-items-center justify-content-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Updating...
              </span>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="text-center px-4 pb-4">
          <Link to="/forgot-password" className="small text-primary fw-semibold text-decoration-none">
            Request a new OTP
          </Link>
        </div>

        <div className="text-center pb-3">
          <p className="small text-muted mb-0">
            © 2026 BELLORA · All rights reserved
          </p>
          <p className="small text-muted mb-0">Version 1.0</p>
        </div>
      </div>
    </div>
  )
}
