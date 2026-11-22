import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import './Register.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
const logoUrl = `${import.meta.env.BASE_URL}bellora-title-logo.svg`

const initialForm = {
  full_name: '',
  email: '',
  phone: '',
  role: 'teacher',
  department: '',
  module_name: '',
  gender: '',
  qualification: '',
  employeeId: '',
  national_id: '',
  school_id: '',
  school_registration_number: '',
  profile_photo: '',
  password: '',
  confirmPassword: ''
}

export default function Register() {
  const navigate = useNavigate()
  useAuthStore()

  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState('details')
  const [pendingEmail, setPendingEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [activeSchools, setActiveSchools] = useState([])
  const [successTitle, setSuccessTitle] = useState('Account Created!')
  const [successDetail, setSuccessDetail] = useState('Redirecting to your dashboard...')
  const [legalDoc, setLegalDoc] = useState(null)
  const otpRefs = useRef([])
  const countdownTimer = useRef(null)
  const cooldownTimer = useRef(null)

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const formattedCountdown = (() => {
    const minutes = String(Math.floor(countdown / 60)).padStart(2, '0')
    const seconds = String(countdown % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  })()

  const otpCode = otpDigits.join('')

  const validate = () => {
    if (form.full_name.length < 3) return 'Full name must be at least 3 characters.'
    if (!emailPattern.test(form.email)) return 'Please enter a valid email.'
    if (!form.phone) return 'Phone number is required.'
    if (!form.department) return 'Department is required.'
    if (!form.qualification) return 'Qualification is required.'
    if (!form.employeeId) return 'Staff ID is required.'
    if (!form.national_id) return 'National ID is required.'
    if (!form.school_id) return 'Select an approved active school.'
    if (!form.gender) return 'Gender is required.'
    if (!form.module_name) return 'Subject specialization is required.'
    if (!selectedPhoto && !form.profile_photo) return 'Profile photo is required.'
    if (!passwordPattern.test(form.password)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
    }
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    if (!acceptedTerms) return 'Please agree to the terms before creating an account.'
    return ''
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    setSelectedPhoto(file || null)
    updateField('profile_photo', '')
  }

  const uploadRegistrationPhoto = async () => {
    if (!selectedPhoto) return form.profile_photo

    const payload = new FormData()
    payload.append('photo', selectedPhoto)
    const response = await api.post('/upload/registration-photo', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const path = response.data.photo?.path || ''
    updateField('profile_photo', path)
    return path
  }

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

  const requestOtp = async () => {
    const validationError = validate()
    setError(validationError)
    setSuccess('')
    if (validationError) return

    setLoading(true)
    try {
      const profilePhoto = await uploadRegistrationPhoto()
      const payload = {
        ...form,
        username: form.full_name,
        phone: form.phone || '',
        profile_photo: profilePhoto,
        school_id: form.school_id,
        role: 'teacher'
      }
      const response = await api.post('/auth/register', payload)
      setPendingEmail(response.data.email)
      setSuccess(response.data.message || 'OTP sent.')
      setOtpDigits(['', '', '', '', '', ''])
      setStep('otp')
      startTimers(response.data.expires_in_seconds || 300, response.data.resend_cooldown_seconds || 45)
      setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = () => requestOtp()

  const verifyOtp = async () => {
    setError('')
    setSuccess('')
    if (otpCode.length !== 6) {
      setError('Enter the complete 6 digit OTP.')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/auth/verify-registration', {
        email: pendingEmail,
        code: otpCode
      })
      const { token, user, role, redirectTo, requiresApproval } = response.data

      if (requiresApproval) {
        setSuccessTitle('Registration Sent!')
        setSuccessDetail('Your teacher account is waiting for admin approval.')
        setSuccess(response.data.message || 'Teacher registered successfully. Awaiting admin approval.')
        setStep('success')
        setTimeout(() => navigate('/login'), 1600)
        return
      }

      localStorage.setItem('token', token)
      localStorage.setItem('userType', role)
      localStorage.setItem(role === 'teacher' ? 'teacher' : 'user', JSON.stringify(user))
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      setStep('success')
      setTimeout(() => navigate(redirectTo || (role === 'teacher' ? '/teacher/dashboard' : '/dashboard')), 900)
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (step === 'details') requestOtp()
    else verifyOtp()
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

  useEffect(() => {
    const loadActiveSchools = async () => {
      try {
        const response = await api.get('/schools/active')
        const byId = new Map()
        ;(response.data.schools || []).forEach((school) => {
          if (!byId.has(school.school_id)) byId.set(school.school_id, school)
        })
        setActiveSchools([...byId.values()])
      } catch (err) {
        setActiveSchools([])
      }
    }
    loadActiveSchools()
  }, [])

  return (
    <div className="register-page min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className={`register-card w-100${loading ? ' is-loading' : ''}`}>
        <div className="register-card-header">
          <div className="brand-login-mark">
            <img className="brand-login-logo" src={logoUrl} alt="School logo" />
          </div>
          <div className="register-brand-copy">
            <h1 className="brand-title mb-0">BELLORA</h1>
            <span>Teacher registration</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {step === 'details' ? (
            <>
              <h2 className="form-title">Create your teacher account</h2>
              <p className="register-intro">Add your details and verify your email to request access to your school's BELLORA workspace.</p>
              <div className="register-steps" aria-label="Registration progress">
                <span className="register-step is-current"><b>1</b><span>Your details</span></span>
                <i></i>
                <span className="register-step"><b>2</b><span>Email verification</span></span>
              </div>

              <div className="register-context">
                <div>
                  <strong>Teacher Account</strong>
                  <span>Join an approved school and wait for DOS approval.</span>
                </div>
                <Link to="/dos/register">Register a School</Link>
              </div>

              <div className="title-rule"></div>

              <div className="register-field">
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <div className="register-input-wrap">
                  <UserRound className="register-input-icon" size={20} strokeWidth={2.25} aria-hidden="true" />
                  <input
                    id="fullName"
                    value={form.full_name}
                    onChange={(event) => updateField('full_name', event.target.value.trim())}
                    type="text"
                    placeholder="Enter your full name"
                    required
                    className="form-control"
                  />
                </div>
              </div>

              <div className="register-field">
                <label htmlFor="email" className="form-label">Email</label>
                <div className="register-input-wrap">
                  <Mail className="register-input-icon" size={20} strokeWidth={2.25} aria-hidden="true" />
                  <input
                    id="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value.trim())}
                    type="email"
                    placeholder="Enter your email address"
                    required
                    className="form-control"
                  />
                </div>
              </div>

              <div className="register-grid">
                <div className="register-field">
                  <label htmlFor="phone" className="form-label">Phone Number</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value.trim())}
                      type="tel"
                      placeholder="Enter phone number"
                      required
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="register-field">
                  <label htmlFor="department" className="form-label">Department</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="department"
                      value={form.department}
                      onChange={(event) => updateField('department', event.target.value.trim())}
                      type="text"
                      placeholder="Department"
                      required
                      className="form-control"
                    />
                  </div>
                </div>
              </div>

              <div className="register-grid">
                <div className="register-field">
                  <label htmlFor="qualification" className="form-label">Qualification</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="qualification"
                      value={form.qualification}
                      onChange={(event) => updateField('qualification', event.target.value.trim())}
                      type="text"
                      placeholder="Highest qualification"
                      required
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="register-field">
                  <label htmlFor="employeeId" className="form-label">Staff ID</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="employeeId"
                      value={form.employeeId}
                      onChange={(event) => updateField('employeeId', event.target.value.trim())}
                      type="text"
                      placeholder="ID number"
                      required
                      className="form-control"
                    />
                  </div>
                </div>
              </div>

              <div className="register-grid">
                <div className="register-field">
                  <label htmlFor="nationalId" className="form-label">National ID</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="nationalId"
                      value={form.national_id}
                      onChange={(event) => updateField('national_id', event.target.value.trim())}
                      type="text"
                      placeholder="National ID number"
                      required
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="register-field">
                  <label htmlFor="schoolId" className="form-label">Select Your School</label>
                  <div className="register-input-wrap plain-input">
                    <select
                      id="schoolId"
                      value={form.school_id}
                      onChange={(event) => updateField('school_id', event.target.value)}
                      required
                      className="form-control"
                    >
                      <option value="">Choose an approved school</option>
                      {activeSchools.map((school) => (
                        <option key={school.school_id} value={school.school_id}>
                          {school.school_name}{school.school_code ? ` (${school.school_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="register-grid">
                <div className="register-field">
                  <label htmlFor="gender" className="form-label">Gender</label>
                  <div className="register-input-wrap plain-input">
                    <select id="gender" value={form.gender} onChange={(event) => updateField('gender', event.target.value)} required className="form-control">
                      <option value="">Select gender</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="register-field">
                  <label htmlFor="specialization" className="form-label">Subject Specialization</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="specialization"
                      value={form.module_name}
                      onChange={(event) => updateField('module_name', event.target.value.trim())}
                      type="text"
                      placeholder="Subject specialization"
                      required
                      className="form-control"
                    />
                  </div>
                </div>
              </div>

              <div className="register-field">
                <label htmlFor="profilePhoto" className="form-label">Profile Photo</label>
                <input
                  id="profilePhoto"
                  type="file"
                  accept="image/*"
                  required
                  className="form-control file-control"
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="register-field">
                <label htmlFor="password" className="form-label">Password</label>
                <div className="register-input-wrap">
                  <LockKeyhole className="register-input-icon" size={20} strokeWidth={2.25} aria-hidden="true" />
                  <input
                    id="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password..."
                    required
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2.2} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="register-field">
                <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                <div className="register-input-wrap">
                  <LockKeyhole className="register-input-icon" size={20} strokeWidth={2.25} aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    required
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2.2} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <label className="terms-row">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="terms-check" />
                <span>
                  I agree to the
                  {' '}
                  <button type="button" className="legal-link" onClick={() => setLegalDoc('terms')}>Terms of Service</button>
                  {' '}and{' '}
                  <button type="button" className="legal-link" onClick={() => setLegalDoc('privacy')}>Privacy Policy</button>
                </span>
              </label>
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <h2 className="form-title">Verify your email</h2>
              <p className="register-intro">Enter the 6-digit code we sent to finish creating your teacher account.</p>
              <div className="register-steps" aria-label="Registration progress">
                <span className="register-step is-complete"><b>1</b><span>Your details</span></span>
                <i></i>
                <span className="register-step is-current"><b>2</b><span>Email verification</span></span>
              </div>
              <div className="title-rule"></div>

              <div className="verification-note">
                <strong>Code sent to {pendingEmail}</strong>
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
                onClick={resendOtp}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </>
          ) : null}

          {step !== 'details' && step !== 'otp' ? (
            <div className="success-panel">
              <div className="success-mark" aria-hidden="true"></div>
              <h2>{successTitle}</h2>
              <p>{successDetail}</p>
            </div>
          ) : null}

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

          {step !== 'success' ? (
            <button
              type="submit"
              disabled={loading}
              className="btn register-submit w-100"
            >
              {loading ? (
                <span className="d-flex align-items-center justify-content-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  {step === 'details' ? 'Sending OTP...' : 'Verifying...'}
                </span>
              ) : (
                <span>
                  {step === 'details' ? 'Sign Up' : 'Verify & Create Account'}
                </span>
              )}
            </button>
          ) : null}

          <div className="login-row">
            <span>Already have an account?</span>
            <Link to="/login">Log In</Link>
          </div>
        </form>
      </div>

      {legalDoc ? (
        <div className="legal-overlay" role="dialog" aria-modal="true" aria-label={legalDoc === 'terms' ? 'Terms of Service' : 'Privacy Policy'} onClick={() => setLegalDoc(null)}>
          <div className="legal-card" onClick={(event) => event.stopPropagation()}>
            <h2>{legalDoc === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h2>
            {legalDoc === 'terms' ? (
              <div className="legal-body">
                <p>By creating a BELLORA account you agree to use the platform only for legitimate school administration, teaching and learning activities.</p>
                <p>You are responsible for keeping your login credentials private and for all activity performed under your account. Accounts must belong to a single person; shared logins are not permitted.</p>
                <p>School data, timetables and results may only be accessed for the school you are registered with. Attempting to access other schools' records may result in suspension.</p>
                <p>BELLORA may update these terms as the platform evolves. Continued use after an update constitutes acceptance of the revised terms.</p>
              </div>
            ) : (
              <div className="legal-body">
                <p>BELLORA stores the information you provide during registration (name, email, phone, school and role) plus the academic records you create or manage inside the platform.</p>
                <p>Your data is used to operate timetables, attendance, results and communication features for your school. It is not sold to third parties.</p>
                <p>Passwords are stored using one-way hashing. You can request correction of your personal details through your school administrator or by contacting BELLORA support.</p>
                <p>Data is retained while your account remains active and for as long as required by your school's record-keeping obligations.</p>
              </div>
            )}
            <button type="button" className="legal-close" onClick={() => setLegalDoc(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
