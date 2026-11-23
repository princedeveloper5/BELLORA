import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Send, ShieldCheck } from 'lucide-react'
import api from '@/stores/api'
import { resolveAssetUrl } from '@/utils/resolveAssetUrl'
import './DosRegister.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
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
  const [searchParams] = useSearchParams()
  const registrationFor = searchParams.get('for') === 'school' ? 'school' : 'dos'
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const uploadedPhotoRef = useRef(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [registrationStep, setRegistrationStep] = useState('school')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(selectedPhoto)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedPhoto])

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handlePhotoChange = (event) => {
    const photo = event.target.files?.[0] || null
    if (photo && !photo.type.startsWith('image/')) {
      setMessage('Choose an image file for the Director profile photo.')
      setHasError(true)
      setSelectedPhoto(null)
      updateField('profile_photo', '')
      event.target.value = ''
      return
    }
    if (photo && photo.size > 2 * 1024 * 1024) {
      setMessage('Choose an image smaller than 2 MB.')
      setHasError(true)
      setSelectedPhoto(null)
      updateField('profile_photo', '')
      event.target.value = ''
      return
    }
    setMessage('')
    setHasError(false)
    uploadedPhotoRef.current = null
    setSelectedPhoto(photo)
    updateField('profile_photo', '')
  }

  const validateSchool = () => {
    if (!form.school_name.trim()) return 'School name is required.'
    if (!emailPattern.test(form.school_email.trim())) return 'Valid school email is required.'
    if (!form.school_phone.trim()) return 'School phone is required.'
    if (!form.registration_number.trim()) return 'School registration number is required.'
    if (!form.school_address.trim()) return 'School address is required.'
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
    if (form.full_name.trim().length < 3) return 'Director full name must be at least 3 characters.'
    if (!emailPattern.test(form.dos_email.trim())) return 'Valid Director of Studies email is required.'
    if (!form.dos_phone.trim()) return 'Director of Studies phone is required.'
    if (!form.national_id.trim()) return 'Director of Studies national ID is required.'
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    if (!passwordPattern.test(form.password)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
    }
    if (!selectedPhoto && !form.profile_photo) return 'Profile photo is required.'
    return ''
  }

  const uploadPhoto = async () => {
    if (!selectedPhoto) return form.profile_photo
    if (uploadedPhotoRef.current === selectedPhoto && form.profile_photo) return form.profile_photo
    const payload = new FormData()
    payload.append('photo', selectedPhoto)
    const response = await api.post('/upload/registration-photo', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const path = response.data.photo?.path || ''
    updateField('profile_photo', path)
    uploadedPhotoRef.current = selectedPhoto
    return path
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
      const cleanForm = Object.fromEntries(Object.entries(form).map(([key, value]) => [
        key,
        typeof value === 'string' && !['password', 'confirmPassword'].includes(key) ? value.trim() : value
      ]))
      const response = await api.post('/schools/dos-register', {
        ...cleanForm,
        profile_photo: profilePhoto,
        phone: form.school_phone
      })
      setMessage(response.data.message)
      setHasError(false)
      setSubmitted(true)
    } catch (error) {
      const validationMessages = error.response?.data?.errors?.map((item) => item.msg || item.message).filter(Boolean).join(' ')
      setMessage(error.response?.data?.message || validationMessages || 'Registration failed. Please check the details and try again.')
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (registrationStep === 'school') goToDosStep()
    else if (registrationStep === 'dos') continueToReview()
    else submitRegistration()
  }

  const backToSchoolStep = () => {
    setMessage('')
    setHasError(false)
    setRegistrationStep('school')
  }

  const backToDirectorStep = () => {
    setMessage('')
    setHasError(false)
    setRegistrationStep('dos')
  }

  const continueToReview = () => {
    const validationError = validate()
    setMessage(validationError)
    setHasError(Boolean(validationError))
    if (!validationError) setRegistrationStep('review')
  }

  const currentStepNumber = { school: 1, dos: 2, review: 3 }[registrationStep]
  const maskedNationalId = form.national_id.length > 4
    ? `•••• ${form.national_id.slice(-4)}`
    : form.national_id

  return (
    <div className="dos-register-page registration-flow-page">
      <div className="registration-flow-top">
        <Link to="/register" className="back-login-link">
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          Account types
        </Link>
        <span className="registration-secure"><LockKeyhole size={14} /> Secure registration</span>
      </div>
      <div className="registration-shell registration-shell--school">
        <aside className="registration-side-panel">
          <img className="registration-aside-logo" src={`${import.meta.env.BASE_URL}bellora-brand-lockup.png`} alt="BELLORA — Smarter Scheduling, Better Learning" />
          <span className="registration-aside-kicker">SCHOOL ONBOARDING</span>
          <h2>Set up your school workspace.</h2>
          <p>Register a new school and create its first Director of Studies account in one request.</p>
          <ol className="registration-side-steps" aria-label="School registration progress">
            <li className={registrationStep === 'school' && !submitted ? 'active' : 'complete'}>
              <span>{registrationStep !== 'school' || submitted ? <Check size={14} /> : '01'}</span>
              <div><strong>School details</strong><small>Organization information</small></div>
            </li>
            <li className={registrationStep === 'dos' && !submitted ? 'active' : registrationStep === 'review' || submitted ? 'complete' : ''}>
              <span>{registrationStep === 'review' || submitted ? <Check size={14} /> : '02'}</span>
              <div><strong>Director profile</strong><small>Account and security</small></div>
            </li>
            <li className={registrationStep === 'review' && !submitted ? 'active' : submitted ? 'complete' : ''}>
              <span>{submitted ? <Check size={14} /> : '03'}</span>
              <div><strong>Review & submit</strong><small>Confirm your request</small></div>
            </li>
          </ol>
          <div className="registration-aside-note">
            <ShieldCheck size={17} />
            <span>New school requests are reviewed before access is enabled.</span>
          </div>
        </aside>
        <section className="register-panel registration-workspace">
        <div className="panel-heading">
          <div className="registration-heading-copy">
            <span className="registration-eyebrow">NEW SCHOOL ONBOARDING · 3 STEPS</span>
            <h1>{registrationFor === 'school' ? 'Register Your School' : 'Director of Studies Registration'}</h1>
            <p>
              {registrationFor === 'school'
                ? 'Set up your school workspace and its first Director of Studies account.'
                : 'Create your Director of Studies account and submit your school for approval.'}
            </p>
          </div>
        </div>

        {registrationFor === 'dos' && !submitted ? (
          <div className="registration-existing-school-note">
            <strong>Is your school already using BELLORA?</strong>
            <span>Contact your system administrator to add your Director account. This form is for a new school and its first Director of Studies.</span>
          </div>
        ) : null}

        {!submitted ? (
          <form className="dos-form" onSubmit={handleSubmit}>
            <div className="registration-stage-heading">
              <div>
                <span>STEP {currentStepNumber} OF 3</span>
                <h2>{registrationStep === 'school'
                  ? 'Tell us about your school'
                  : registrationStep === 'dos'
                    ? 'Set up the Director of Studies'
                    : 'Review your application'}</h2>
                <p>{registrationStep === 'school'
                  ? 'Use the official school details so our team can verify your request.'
                  : registrationStep === 'dos'
                    ? 'This person will manage the school workspace after approval.'
                    : 'Check these details before sending your school registration for approval.'}</p>
              </div>
              {registrationStep !== 'review' ? <span className="registration-required-note">* Required</span> : null}
            </div>

            {registrationStep === 'school' ? (
              <div>
                <div className="form-grid">
                  <label>
                    <span>School name <b>*</b></span>
                    <input autoComplete="organization" placeholder="e.g. Green Hills Secondary School" value={form.school_name} onChange={(event) => updateField('school_name', event.target.value)} required type="text" />
                  </label>
                  <label>
                    <span>School code <small>Optional</small></span>
                    <input placeholder="Your existing school code, if any" value={form.school_code} onChange={(event) => updateField('school_code', event.target.value)} type="text" />
                  </label>
                  <label>
                    <span>Official school email <b>*</b></span>
                    <input autoComplete="email" placeholder="office@school.org" value={form.school_email} onChange={(event) => updateField('school_email', event.target.value)} required type="email" />
                  </label>
                  <label>
                    <span>School phone <b>*</b></span>
                    <input autoComplete="tel" placeholder="School contact number" value={form.school_phone} onChange={(event) => updateField('school_phone', event.target.value)} required type="tel" />
                  </label>
                  <label>
                    <span>Registration number <b>*</b></span>
                    <input placeholder="Official school registration number" value={form.registration_number} onChange={(event) => updateField('registration_number', event.target.value)} required type="text" />
                  </label>
                  <label>
                    <span>School type <small>Optional</small></span>
                    <select value={form.school_type} onChange={(event) => updateField('school_type', event.target.value)}>
                      <option value="">Select type</option>
                      <option>Public</option>
                      <option>Private</option>
                      <option>Government Aided</option>
                      <option>International</option>
                    </select>
                  </label>
                  <label>
                    <span>Province <small>Optional</small></span>
                    <input autoComplete="address-level1" placeholder="Province" value={form.province} onChange={(event) => updateField('province', event.target.value)} type="text" />
                  </label>
                  <label>
                    <span>District <small>Optional</small></span>
                    <input autoComplete="address-level2" placeholder="District" value={form.district} onChange={(event) => updateField('district', event.target.value)} type="text" />
                  </label>
                  <label>
                    <span>Sector <small>Optional</small></span>
                    <input placeholder="Sector" value={form.sector} onChange={(event) => updateField('sector', event.target.value)} type="text" />
                  </label>
                  <label className="wide">
                    <span>School address <b>*</b></span>
                    <textarea autoComplete="street-address" placeholder="Street, neighborhood, district" value={form.school_address} onChange={(event) => updateField('school_address', event.target.value)} required rows={3}></textarea>
                  </label>
                </div>
              </div>
            ) : registrationStep === 'dos' ? (
              <div>
                <div className="form-grid">
                  <label>
                    <span>Full name <b>*</b></span>
                    <input autoComplete="name" placeholder="Director's full legal name" value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} required type="text" />
                  </label>
                  <label>
                    <span>Work email <b>*</b></span>
                    <input autoComplete="email" placeholder="director@school.org" value={form.dos_email} onChange={(event) => updateField('dos_email', event.target.value)} required type="email" />
                  </label>
                  <label>
                    <span>Phone number <b>*</b></span>
                    <input autoComplete="tel" placeholder="Director's contact number" value={form.dos_phone} onChange={(event) => updateField('dos_phone', event.target.value)} required type="tel" />
                  </label>
                  <label>
                    <span>National ID <b>*</b></span>
                    <input autoComplete="off" placeholder="Official identification number" value={form.national_id} onChange={(event) => updateField('national_id', event.target.value)} required type="text" />
                  </label>
                  <label>
                    <span>Password <b>*</b></span>
                    <div className="password-wrap">
                      <input autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => updateField('password', event.target.value)} required type={showPassword ? 'text' : 'password'} />
                      <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((prev) => !prev)}>
                        {showPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                      </button>
                    </div>
                    <small className="registration-password-hint">Use 8+ characters with uppercase and lowercase letters and a number.</small>
                  </label>
                  <label>
                    <span>Confirm password <b>*</b></span>
                    <div className="password-wrap">
                      <input autoComplete="new-password" placeholder="Enter the same password again" value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} required type={showConfirmPassword ? 'text' : 'password'} />
                      <button type="button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword((prev) => !prev)}>
                        {showConfirmPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>
                  <label className="wide">
                    <span>Profile photo <b>*</b></span>
                    <div className="registration-photo-picker">
                      {photoPreview ? <img src={photoPreview} alt="Selected Director profile preview" /> : <span className="registration-photo-placeholder">Photo</span>}
                      <div>
                        <input required type="file" accept="image/*" onChange={handlePhotoChange} />
                        <small className="registration-file-hint">Clear headshot, image format, up to 2 MB. {selectedPhoto?.name || ''}</small>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="registration-review-grid">
                <section className="registration-review-card">
                  <header>
                    <div><span>ORGANIZATION</span><h3>School details</h3></div>
                    <button type="button" onClick={backToSchoolStep}>Edit</button>
                  </header>
                  <dl>
                    <div><dt>School name</dt><dd>{form.school_name}</dd></div>
                    <div><dt>Official email</dt><dd>{form.school_email}</dd></div>
                    <div><dt>Phone</dt><dd>{form.school_phone}</dd></div>
                    <div><dt>Registration number</dt><dd>{form.registration_number}</dd></div>
                    {form.school_code ? <div><dt>School code</dt><dd>{form.school_code}</dd></div> : null}
                    {form.school_type ? <div><dt>School type</dt><dd>{form.school_type}</dd></div> : null}
                    <div className="registration-review-row-wide"><dt>Address</dt><dd>{form.school_address}</dd></div>
                    {[form.province, form.district, form.sector].some(Boolean) ? (
                      <div className="registration-review-row-wide"><dt>Location</dt><dd>{[form.sector, form.district, form.province].filter(Boolean).join(', ')}</dd></div>
                    ) : null}
                  </dl>
                </section>

                <section className="registration-review-card">
                  <header>
                    <div><span>ACCOUNT OWNER</span><h3>Director of Studies</h3></div>
                    <button type="button" onClick={backToDirectorStep}>Edit</button>
                  </header>
                  <div className="registration-review-director">
                    <img src={photoPreview || resolveAssetUrl(form.profile_photo)} alt="Director profile" />
                    <dl>
                      <div><dt>Full name</dt><dd>{form.full_name}</dd></div>
                      <div><dt>Work email</dt><dd>{form.dos_email}</dd></div>
                      <div><dt>Phone</dt><dd>{form.dos_phone}</dd></div>
                      <div><dt>National ID</dt><dd>{maskedNationalId}</dd></div>
                    </dl>
                  </div>
                </section>
                <div className="registration-review-final-note">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>By submitting, you confirm these details are accurate. BELLORA will review the new school and Director account before access is enabled. Your password will not appear in this summary.</span>
                </div>
              </div>
            )}

            {registrationStep !== 'review' ? (
              <div className="registration-review-note">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>Your school and Director of Studies account are reviewed before workspace access is enabled.</span>
              </div>
            ) : null}

            {message ? <p className={`form-message${hasError ? ' error' : ''}`} role={hasError ? 'alert' : 'status'}>{message}</p> : null}

            <div className="form-actions">
              {registrationStep === 'dos' ? (
                <>
                  <button className="secondary-button" type="button" disabled={loading} onClick={backToSchoolStep}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" className="registration-continue" disabled={loading} onClick={continueToReview}>
                    <span>Review application</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </>
              ) : registrationStep === 'review' ? (
                <>
                  <button className="secondary-button" type="button" disabled={loading} onClick={backToDirectorStep}>
                    <ArrowLeft size={15} /> Back to director
                  </button>
                  <button type="submit" disabled={loading}>
                    <Send size={16} strokeWidth={2.2} aria-hidden="true" />
                    <span>{loading ? 'Submitting request…' : 'Submit registration'}</span>
                  </button>
                </>
              ) : (
                <button type="submit" className="registration-continue" disabled={loading}>
                  <span>Continue to director details</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="registration-login-prompt">Already have an account? <Link to="/login">Sign in</Link></p>
          </form>
        ) : (
          <div className="registration-success" role="status">
            <span className="registration-success-icon"><Check size={26} /></span>
            <p className="registration-eyebrow">REQUEST RECEIVED</p>
            <h2>Registration submitted</h2>
            <p>Your school and Director of Studies account are waiting for administrator approval. You can sign in after the request has been approved.</p>
            <Link to="/login">Return to sign in</Link>
          </div>
        )}
      </section>
      </div>
    </div>
  )
}
