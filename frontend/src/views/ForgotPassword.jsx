import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/stores/api'
import './ForgotPassword.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const logoUrl = `${import.meta.env.BASE_URL}panta-title-logo.png`

export default function ForgotPassword() {
  const navigate = useNavigate()

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const otpRefs = useRef([])
  const countdownTimer = useRef(null)
  const cooldownTimer = useRef(null)

  const emailError = (() => {
    const value = email.trim()
    if (!value) return ''
    if (!emailPattern.test(value)) return 'Invalid email address.'
    return ''
  })()

  const otpCode = otpDigits.join('')

  const formattedCountdown = (() => {
    const minutes = String(Math.floor(countdown / 60)).padStart(2, '0')
    const seconds = String(countdown % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  })()

  const startTimers = (expires = 300, cooldown = 45) => {
    clearInterval(countdownTimer.current)
    clearInterval(cooldownTimer.current)
    setCountdown(expires)
    setResendCooldown(cooldown)
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0) clearInterval(countdownTimer.current)
        return next
      })
    }, 1000)
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0) clearInterval(cooldownTimer.current)
        return next
      })
    }, 1000)
  }

  const requestCode = async () => {
    setError('')
    setSuccess('')

    if (emailError || !email.trim()) {
      setError(emailError || 'Email is required.')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/auth/forgot-password', { email })
      setSuccess(response.data.message || 'OTP sent.')
      setStep('otp')
      setOtpDigits(['', '', '', '', '', ''])
      startTimers(response.data.expires_in_seconds || 300, response.data.resend_cooldown_seconds || 45)
      setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setError('')
    setSuccess('')

    if (otpCode.length !== 6) {
      setError('Enter the complete 6 digit OTP.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/verify-reset-code', { email, code: otpCode })
      sessionStorage.setItem('resetEmail', email)
      sessionStorage.setItem('resetCode', otpCode)
      navigate('/reset-password')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (step === 'email') requestCode()
    else verifyCode()
  }

  const handleOtpInput = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(0, 1)
    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpBackspace = (index, event) => {
    if (!otpDigits[index] && index > 0) {
      event.preventDefault()
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (event) => {
    event.preventDefault()
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    setOtpDigits((prev) => {
      const next = [...prev]
      digits.forEach((digit, index) => {
        next[index] = digit
      })
      return next
    })
    otpRefs.current[Math.min(digits.length, 5)]?.focus()
  }

  useEffect(() => {
    return () => {
      clearInterval(countdownTimer.current)
      clearInterval(cooldownTimer.current)
    }
  }, [])

  return (
    <div className="forgot-page min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className={`forgot-card w-100${loading ? ' is-loading' : ''}`}>
        <div className="forgot-card-header">
          <div className="brand-login-mark">
            <img className="brand-login-logo" src={logoUrl} alt="School logo" />
          </div>
          <h1 className="auth-title mb-0">PANTA</h1>
        </div>

        <form onSubmit={handleSubmit} className="forgot-form">
          <h2 className="form-title">Forgot Password</h2>
          <div className="title-rule"></div>

          <div className="step-indicator">
            <div className={`step${step === 'email' ? ' active' : ''}${step === 'otp' ? ' complete' : ''}`}>
              <span>1</span>
              <small>Email</small>
            </div>
            <div className={`step-line${step === 'otp' ? ' active' : ''}`}></div>
            <div className={`step${step === 'otp' ? ' active' : ''}`}>
              <span>2</span>
              <small>Verify</small>
            </div>
          </div>

          <div className="fade-slide-panel">
            {step === 'email' ? (
              <div key="email">
                <div className="forgot-field">
                  <label htmlFor="email" className="form-label">Email Address</label>
                  <div className="forgot-input-wrap">
                    <span className="forgot-input-icon mail-icon" aria-hidden="true"></span>
                    <input
                      id="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value.trim())}
                      type="email"
                      placeholder="Enter your registered email"
                      required
                      className={`form-control${emailError ? ' is-invalid' : ''}`}
                      autoComplete="email"
                    />
                  </div>
                  {emailError ? (
                    <div className="invalid-feedback d-block mt-1">
                      {emailError}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key="otp">
                <div className="verification-note">
                  <strong>Code sent to {email}</strong>
                  <span>Expires in {formattedCountdown}</span>
                </div>

                <label htmlFor="otp" className="form-label">Enter 6-Digit OTP</label>
                <div className="otp-grid" onPaste={handleOtpPaste}>
                  {otpDigits.map((_, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el }}
                      value={otpDigits[index]}
                      onChange={(event) => handleOtpInput(index, event.target.value)}
                      inputMode="numeric"
                      maxLength={1}
                      aria-label="OTP digit"
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace') handleOtpBackspace(index, event)
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="resend-btn"
                  disabled={resendCooldown > 0 || loading}
                  onClick={requestCode}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            )}
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="alert alert-success" role="alert">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn forgot-submit w-100"
          >
            {loading ? (
              <span className="d-flex align-items-center justify-content-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                {step === 'email' ? 'Sending OTP...' : 'Verifying...'}
              </span>
            ) : (
              <span>
                {step === 'email' ? 'Send OTP' : 'Verify OTP'}
              </span>
            )}
          </button>

          <div className="login-row">
            <span>Remember your password?</span>
            <Link to="/login">Log In</Link>
          </div>

          <div className="create-row">
            <span>New user?</span>
            <Link to="/teacher/register">Create an Account</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
