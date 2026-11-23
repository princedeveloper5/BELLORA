import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
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
      const response = await api.post('/auth/reset-password', { email, code, password, confirmPassword })
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
    if (!storedEmail || !storedCode) setError('Reset session not found. Please request a new verification code.')
  }, [])

  return (
    <main className="reset-page">
      <section className="reset-card" aria-labelledby="reset-title">
        <aside className="reset-aside">
          <div>
            <div className="reset-brand-mark">
              <img className="brand-login-logo" src={`${import.meta.env.BASE_URL}bellora-brand-mark.png`} alt="BELLORA logo" />
            </div>
            <h1 id="reset-title">A fresh start for your account.</h1>
            <p>Choose a new password to secure your BELLORA workspace and get back to the work that matters.</p>
          </div>
          <div className="reset-privacy"><ShieldCheck size={16} aria-hidden="true" /> Your verification code is confirmed.</div>
        </aside>

        <div className="reset-form">
          <h2>Create a new password</h2>
          <p>Use at least 6 characters. A longer passphrase is harder to guess.</p>

          <div className="reset-identity">
            <CheckCircle2 size={19} aria-hidden="true" />
            <div><span>Verified account</span><strong>{email || 'Your account'}</strong></div>
          </div>

          <form onSubmit={resetPassword}>
            <div className="reset-field">
              <label htmlFor="password">New password</label>
              <div className="input-group">
                <input
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter a new password"
                  autoComplete="new-password"
                  required
                  className="form-control"
                />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((prev) => !prev)}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="reset-field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <div className="input-group">
                <input
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Enter it one more time"
                  autoComplete="new-password"
                  required
                  className="form-control"
                />
                <button type="button" className="password-toggle" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword((prev) => !prev)}>
                  {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
            {success ? <div className="alert alert-success" role="status">{success}</div> : null}

            <button type="submit" disabled={loading || !email || !code} className="reset-submit">
              {loading ? 'Updating password…' : <><LockKeyhole size={16} aria-hidden="true" /> Update password</>}
            </button>
          </form>

          <div className="reset-footer"><Link to="/forgot-password">Request a new verification code</Link></div>
        </div>
      </section>
    </main>
  )
}
