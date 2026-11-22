import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Eye, EyeOff, Send, ShieldCheck } from 'lucide-react'
import api from '@/stores/api'
import './DosRegister.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
const logoUrl = `${import.meta.env.BASE_URL}panta-logo.png`

const initialForm = {
  full_name: '',
  school_name: '',
  school_code: '',
  school_email: '',
  school_phone: '',
  dos_email: '',
  dos_phone: '',
  national_id: '',
  registration_number: '',
  school_type: '',
  province: '',
  district: '',
  sector: '',
  school_address: '',
  password: '',
  confirmPassword: '',
  profile_photo: ''
}

export default function DosRegister() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [registrationStep, setRegistrationStep] = useState('school')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState(initialForm)

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handlePhotoChange = (event) => {
    setSelectedPhoto(event.target.files?.[0] || null)
    updateField('profile_photo', '')
  }

  const validateSchool = () => {
    if (!form.school_name) return 'School name is required.'
    if (!emailPattern.test(form.school_email)) return 'Valid school email is required.'
    if (!form.school_phone) return 'School phone is required.'
    if (!form.registration_number) return 'School registration number is required.'
    if (!form.school_address) return 'School address is required.'
    return ''
  }

  const goToDosStep = () => {
    const schoolError = validateSchool()
    setMessage(schoolError)
    setHasError(Boolean(schoolError))
    if (schoolError) return
    setMessage('')
    setRegistrationStep('dos')
  }

  const validate = () => {
    const schoolError = validateSchool()
    if (schoolError) return schoolError
    if (!form.full_name) return 'DOS full name is required.'
    if (!emailPattern.test(form.dos_email)) return 'Valid DOS email is required.'
    if (!form.dos_phone) return 'DOS phone is required.'
    if (!form.national_id) return 'DOS national ID is required.'
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    if (!passwordPattern.test(form.password)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
    }
    if (!selectedPhoto && !form.profile_photo) return 'Profile photo is required.'
    return ''
  }

  const uploadPhoto = async () => {
    if (!selectedPhoto) return form.profile_photo
    const payload = new FormData()
    payload.append('photo', selectedPhoto)
    const response = await api.post('/upload/registration-photo', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data.photo?.path || ''
  }

  const submitRegistration = async () => {
    const validationError = validate()
    setMessage(validationError)
    setHasError(Boolean(validationError))
    if (validationError) return

    setLoading(true)
    try {
      const profilePhoto = await uploadPhoto()
      updateField('profile_photo', profilePhoto)
      const response = await api.post('/schools/dos-register', {
        ...form,
        profile_photo: profilePhoto,
        phone: form.school_phone
      })
      setMessage(response.data.message)
      setHasError(false)
      setSubmitted(true)
    } catch (error) {
      setMessage(error.response?.data?.message || 'Registration failed.')
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (registrationStep === 'school') goToDosStep()
    else submitRegistration()
  }

  const handleStepClick = (event) => {
    event.preventDefault()
    goToDosStep()
  }

  return (
    <div className="dos-register-page">
      <Link to="/login" className="back-login-link">
        <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
        Back to login
      </Link>
      <section className="register-panel">
        <div className="panel-heading">
          <div className="school-register-mark">
            <Building2 size={25} strokeWidth={2.25} aria-hidden="true" />
            <img src={logoUrl} alt="PANTA logo" />
          </div>
          <div>
            <h1>Director of Studies Registration</h1>
            <p>Submit your school for platform verification.</p>
          </div>
        </div>

        {!submitted ? (
          <form className="dos-form" onSubmit={handleSubmit}>
            <div className="step-tracker" aria-label="Registration steps">
              <span className={registrationStep === 'school' ? 'active' : ''}>1. School</span>
              <span className={registrationStep === 'dos' ? 'active' : ''}>2. DOS</span>
              <span>3. Registration</span>
            </div>

            {registrationStep === 'school' ? (
              <div>
                <div className="form-section-title">
                  <ShieldCheck size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>First add school</span>
                </div>
                <div className="form-grid">
                  <label>
                    <span>School Name</span>
                    <input value={form.school_name} onChange={(event) => updateField('school_name', event.target.value.trim())} required type="text" />
                  </label>
                  <label>
                    <span>School Code</span>
                    <input value={form.school_code} onChange={(event) => updateField('school_code', event.target.value.trim())} type="text" />
                  </label>
                  <label>
                    <span>School Email</span>
                    <input value={form.school_email} onChange={(event) => updateField('school_email', event.target.value.trim())} required type="email" />
                  </label>
                  <label>
                    <span>School Phone</span>
                    <input value={form.school_phone} onChange={(event) => updateField('school_phone', event.target.value.trim())} required type="tel" />
                  </label>
                  <label>
                    <span>School Registration Number</span>
                    <input value={form.registration_number} onChange={(event) => updateField('registration_number', event.target.value.trim())} required type="text" />
                  </label>
                  <label>
                    <span>School Type</span>
                    <select value={form.school_type} onChange={(event) => updateField('school_type', event.target.value)}>
                      <option value="">Select type</option>
                      <option>Public</option>
                      <option>Private</option>
                      <option>Government Aided</option>
                      <option>International</option>
                    </select>
                  </label>
                  <label>
                    <span>Province</span>
                    <input value={form.province} onChange={(event) => updateField('province', event.target.value.trim())} type="text" />
                  </label>
                  <label>
                    <span>District</span>
                    <input value={form.district} onChange={(event) => updateField('district', event.target.value.trim())} type="text" />
                  </label>
                  <label>
                    <span>Sector</span>
                    <input value={form.sector} onChange={(event) => updateField('sector', event.target.value.trim())} type="text" />
                  </label>
                  <label className="wide">
                    <span>School Address</span>
                    <textarea value={form.school_address} onChange={(event) => updateField('school_address', event.target.value.trim())} required rows={3}></textarea>
                  </label>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-section-title">
                  <ShieldCheck size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>Then add Director of Studies</span>
                </div>
                <div className="form-grid">
                  <label>
                    <span>DOS Full Name</span>
                    <input value={form.full_name} onChange={(event) => updateField('full_name', event.target.value.trim())} required type="text" />
                  </label>
                  <label>
                    <span>DOS Email</span>
                    <input value={form.dos_email} onChange={(event) => updateField('dos_email', event.target.value.trim())} required type="email" />
                  </label>
                  <label>
                    <span>DOS Phone</span>
                    <input value={form.dos_phone} onChange={(event) => updateField('dos_phone', event.target.value.trim())} required type="tel" />
                  </label>
                  <label>
                    <span>DOS National ID</span>
                    <input value={form.national_id} onChange={(event) => updateField('national_id', event.target.value.trim())} required type="text" />
                  </label>
                  <label>
                    <span>Password</span>
                    <div className="password-wrap">
                      <input value={form.password} onChange={(event) => updateField('password', event.target.value)} required type={showPassword ? 'text' : 'password'} />
                      <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((prev) => !prev)}>
                        {showPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>
                  <label>
                    <span>Confirm Password</span>
                    <div className="password-wrap">
                      <input value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} required type={showConfirmPassword ? 'text' : 'password'} />
                      <button type="button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword((prev) => !prev)}>
                        {showConfirmPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>
                  <label className="wide">
                    <span>Profile Photo</span>
                    <input required type="file" accept="image/*" onChange={handlePhotoChange} />
                  </label>
                </div>
              </div>
            )}

            {message ? <p className={`form-message${hasError ? ' error' : ''}`}>{message}</p> : null}

            <div className="form-actions">
              {registrationStep === 'dos' ? (
                <button className="secondary-button" type="button" disabled={loading} onClick={handleStepClick}>
                  Back to School
                </button>
              ) : null}
              <button type="submit" disabled={loading}>
                <Send size={17} strokeWidth={2.2} aria-hidden="true" />
                {registrationStep === 'school' ? (
                  <span>Add DOS</span>
                ) : (
                  <span>{loading ? 'Submitting registration...' : 'Submit Registration'}</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="success-panel">
            <strong>Registration Submitted</strong>
            <p>Your registration has been submitted successfully and is waiting for system administrator approval.</p>
            <Link to="/login">Return to Login</Link>
          </div>
        )}
      </section>
    </div>
  )
}
