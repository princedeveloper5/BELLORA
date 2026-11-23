import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import './Register.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
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
const normalizeForm = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [
  key,
  typeof value === 'string' && !['password', 'confirmPassword'].includes(key) ? value.trim() : value
]))

export default function Register() {
  const navigate = useNavigate()
  useAuthStore()

  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState('details')
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingForm, setPendingForm] = useState(null)
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
  const [schoolLoadStatus, setSchoolLoadStatus] = useState('loading')
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
  const pendingDetailsChanged = Boolean(
    pendingForm && Object.keys(pendingForm).some((key) => normalizeForm(form)[key] !== pendingForm[key])
  )
  const pendingEmailChanged = Boolean(pendingEmail && form.email.trim().toLowerCase() !== pendingEmail.trim().toLowerCase())
  const waitingToUpdatePendingCode = Boolean(
    pendingEmail && pendingDetailsChanged && !pendingEmailChanged && resendCooldown > 0
  )

  const validate = () => {
    const clean = normalizeForm(form)
    if (clean.full_name.length < 3) return 'Full name must be at least 3 characters.'
    if (!emailPattern.test(clean.email)) return 'Please enter a valid email.'
    if (!clean.phone) return 'Phone number is required.'
    if (!clean.department) return 'Department is required.'
    if (!clean.qualification) return 'Qualification is required.'
    if (!clean.employeeId) return 'Staff ID is required.'
    if (!clean.national_id) return 'National ID is required.'
    if (!form.school_id) return 'Select an approved active school.'
    if (!form.gender) return 'Gender is required.'
    if (!clean.module_name) return 'Subject specialization is required.'
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
    if (file && !file.type.startsWith('image/')) {
      setError('Choose an image file for your profile photo.')
      setSelectedPhoto(null)
      updateField('profile_photo', '')
      event.target.value = ''
      return
    }
    if (file && file.size > 2 * 1024 * 1024) {
      setError('Choose a profile photo smaller than 2 MB.')
      setSelectedPhoto(null)
      updateField('profile_photo', '')
      event.target.value = ''
      return
    }
    setError('')
    setSelectedPhoto(file || null)
    updateField('profile_photo', '')
  }

  const returnToDetails = () => {
    setStep('details')
    setError('')
    setSuccess('')
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
    setSelectedPhoto(null)
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
      const cleanForm = normalizeForm(form)
      const payload = {
        ...cleanForm,
        username: cleanForm.full_name,
        phone: cleanForm.phone || '',
        profile_photo: profilePhoto,
        school_id: form.school_id,
        role: 'teacher'
      }
      const response = await api.post('/auth/register', payload)
      setPendingEmail(response.data.email)
      setPendingForm({ ...cleanForm, profile_photo: profilePhoto })
      setForm((prev) => ({ ...prev, ...cleanForm }))
      setSuccess(response.data.message || 'OTP sent.')
      setOtpDigits(['', '', '', '', '', ''])
      setStep('otp')
      startTimers(response.data.expires_in_seconds || 300, response.data.resend_cooldown_seconds || 45)
      setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (err) {
      const validationMessages = err.response?.data?.errors?.map((item) => item.msg || item.message).filter(Boolean).join(' ')
      setError(err.response?.data?.message || validationMessages || 'Unable to send the verification code. Please try again.')
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
        setStep('success')
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
    if (step === 'details' && pendingEmail && !pendingDetailsChanged) {
      setError('')
      setStep('otp')
    } else if (step === 'details') requestOtp()
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

  const loadActiveSchools = async () => {
    setSchoolLoadStatus('loading')
    try {
      const response = await api.get('/schools/active')
      const byId = new Map()
      ;(response.data.schools || []).forEach((school) => {
        if (!byId.has(school.school_id)) byId.set(school.school_id, school)
      })
      setActiveSchools([...byId.values()])
      setSchoolLoadStatus('ready')
    } catch {
      setActiveSchools([])
      setSchoolLoadStatus('error')
    }
  }

  useEffect(() => {
    return () => {
      clearInterval(countdownTimer.current)
      clearInterval(cooldownTimer.current)
    }
  }, [])

  useEffect(() => {
    loadActiveSchools()
  }, [])

  return (
    <div className="register-page registration-flow-page registration-flow-page--teacher">
      <div className="registration-flow-top">
        <Link to="/register" className="back-login-link"><ArrowLeft size={16} /> Account types</Link>
        <span className="registration-secure"><LockKeyhole size={14} /> Secure teacher application</span>
      </div>
      <div className="registration-shell registration-shell--teacher">
        <aside className="registration-side-panel">
          <img className="registration-aside-logo" src={`${import.meta.env.BASE_URL}bellora-brand-lockup.png`} alt="BELLORA — Smarter Scheduling, Better Learning" />
          <span className="registration-aside-kicker">TEACHER APPLICATION</span>
          <h1>Join your school’s teaching team.</h1>
          <p>Share your details and verify your email. Your school Director of Studies reviews each teacher request.</p>
          <ol className="registration-side-steps" aria-label="Teacher registration progress">
            <li className={step === 'details' ? 'active' : 'complete'}>
              <span>{step === 'details' ? '01' : <Check size={14} />}</span>
              <div><strong>Your details</strong><small>Profile, school and account</small></div>
            </li>
            <li className={step === 'otp' ? 'active' : step === 'success' ? 'complete' : ''}>
              <span>{step === 'success' ? <Check size={14} /> : '02'}</span>
              <div><strong>Email verification</strong><small>Confirm your email address</small></div>
            </li>
          </ol>
          <div className="registration-aside-note">
            <ShieldCheck size={17} />
            <span>Your request is sent only to the school you select.</span>
          </div>
        </aside>

        <main className={`register-card registration-form-panel w-100${loading ? ' is-loading' : ''}`}>
        <form onSubmit={handleSubmit} className="register-form">
          {step === 'details' ? (
            <>
              <h2 className="form-title">Create your teacher account</h2>
              <p className="register-intro">Add your details and verify your email to request access to your school's BELLORA workspace.</p>
              <div className="register-context">
                <div>
                  <strong>Teacher Account</strong>
                  <span>Join an approved school and wait for DOS approval.</span>
                </div>
                <Link to="/register">Choose another account type</Link>
              </div>

              {pendingEmail ? (
                <div className={`registration-code-return-note${pendingDetailsChanged ? ' has-changes' : ''}`}>
                  <strong>Verification sent to {pendingEmail}</strong>
                  <span>{pendingDetailsChanged
                    ? !pendingEmailChanged && resendCooldown > 0
                      ? `You changed these details. Wait ${resendCooldown} seconds before requesting an updated code.`
                      : 'You changed these details. Send a new code to apply them to your request.'
                    : `Your current code is still active for ${formattedCountdown}. Return to verification when ready.`}</span>
                  {!pendingDetailsChanged ? (
                    <button type="button" onClick={() => { setError(''); setStep('otp') }}>Return to verification</button>
                  ) : null}
                </div>
              ) : null}

              <div className="title-rule"></div>

              <div className="register-section-heading">
                <strong>Personal information</strong>
                <span>Use the name and contact details that match your school records.</span>
              </div>

              <div className="register-field">
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <div className="register-input-wrap">
                  <UserRound className="register-input-icon" size={20} strokeWidth={2.25} aria-hidden="true" />
                  <input
                    id="fullName"
                    value={form.full_name}
                    onChange={(event) => updateField('full_name', event.target.value)}
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
                    onChange={(event) => updateField('email', event.target.value)}
                    type="email"
                    placeholder="Enter your email address"
                    required
                    className="form-control"
                  />
                </div>
              </div>

              <div className="register-section-heading">
                <strong>Teaching and school details</strong>
                <span>Select the approved school where you teach. Your request will go to its Director of Studies.</span>
              </div>

              <div className="register-grid">
                <div className="register-field">
                  <label htmlFor="phone" className="form-label">Phone Number</label>
                  <div className="register-input-wrap plain-input">
                    <input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
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
                      onChange={(event) => updateField('department', event.target.value)}
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
                      onChange={(event) => updateField('qualification', event.target.value)}
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
                      onChange={(event) => updateField('employeeId', event.target.value)}
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
                      onChange={(event) => updateField('national_id', event.target.value)}
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
                      disabled={schoolLoadStatus !== 'ready' || activeSchools.length === 0}
                      className="form-control"
                    >
                      <option value="">
                        {schoolLoadStatus === 'loading' ? 'Loading approved schools…' : schoolLoadStatus === 'error' ? 'School list could not be loaded' : 'Choose an approved school'}
                      </option>
                      {activeSchools.map((school) => (
                        <option key={school.school_id} value={school.school_id}>
                          {school.school_name}{school.school_code ? ` (${school.school_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {schoolLoadStatus === 'loading' ? <p className="register-school-empty" role="status">Loading approved schools…</p> : null}
                  {schoolLoadStatus === 'error' ? (
                    <p className="register-school-empty" role="alert">We couldn’t load the school list. <button type="button" onClick={loadActiveSchools}>Try again</button></p>
                  ) : null}
                  {schoolLoadStatus === 'ready' && activeSchools.length === 0 ? (
                    <p className="register-school-empty">There are no approved schools available yet. <Link to="/dos/register?for=school">Register a new school</Link>.</p>
                  ) : null}
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
                      onChange={(event) => updateField('module_name', event.target.value)}
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
                  required={!form.profile_photo}
                  className="form-control file-control"
                  onChange={handlePhotoChange}
                />
                <small className="register-file-hint">Image only, up to 2 MB. {selectedPhoto?.name || (form.profile_photo ? 'Profile photo uploaded. Choose another to replace it.' : 'A clear headshot works best.')}</small>
              </div>

              <div className="register-section-heading">
                <strong>Secure your account</strong>
                <span>Use at least 8 characters, including uppercase, lowercase, and a number.</span>
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
              <div className="title-rule"></div>

              <div className="verification-note">
                <strong>Code sent to {pendingEmail}</strong>
                <span>Expires in {formattedCountdown}</span>
              </div>
              <button type="button" className="register-edit-details" onClick={returnToDetails}>
                Wrong email or details? Go back and edit
              </button>

              <label htmlFor="otp" className="form-label">Enter 6-Digit OTP</label>
              <div className="otp-grid" onPaste={handleOtpPaste}>
                {otpDigits.map((_, index) => (
                  <input
                    key={index}
                    id={index === 0 ? 'otp' : `otp-${index + 1}`}
                    ref={(el) => { otpRefs.current[index] = el }}
                    aria-label={`Verification code digit ${index + 1}`}
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
              disabled={loading || (step === 'details' && (schoolLoadStatus !== 'ready' || activeSchools.length === 0 || waitingToUpdatePendingCode))}
              className="btn register-submit w-100"
            >
              {loading ? (
                <span className="d-flex align-items-center justify-content-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  {step === 'details' ? 'Sending OTP...' : 'Verifying...'}
                </span>
              ) : (
                <span>
                  {step === 'details'
                    ? pendingEmail && !pendingDetailsChanged
                      ? 'Return to email verification'
                      : pendingDetailsChanged
                        ? waitingToUpdatePendingCode ? `Wait ${resendCooldown}s to update details` : 'Send updated verification code'
                        : 'Send verification code'
                    : 'Verify & Create Account'}
                </span>
              )}
            </button>
          ) : null}

          <div className="login-row">
            {step === 'success' && successTitle === 'Registration Sent!' ? (
              <><span>When your school approves the request, return here to</span><Link to="/login">sign in</Link></>
            ) : (
              <><span>Already have an account?</span><Link to="/login">Log In</Link></>
            )}
          </div>
        </form>
        </main>
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
