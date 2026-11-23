import { useEffect, useState } from 'react'
import { Camera, CircleUserRound, KeyRound, SlidersHorizontal, LoaderCircle, X } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import PasswordStrength from '@/sa/components/PasswordStrength'
import { dosActions } from './dosStore'
import { useAuthStore } from '@/stores/authStore'
import api from '@/stores/api'
import { resolveAssetUrl } from '@/utils/resolveAssetUrl'
import './DosSettings.css'

const tabs = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'constraints', label: 'Scheduling Constraints' }
]

const notifPrefs = [
  { key: 'timetablePublished', label: 'Timetable published', desc: 'Notify me when a timetable is published for my school.' },
  { key: 'conflictDetected', label: 'Conflict detected', desc: 'Alert me when a scheduling conflict appears in the published timetable.' },
  { key: 'overloadWarning', label: 'Teacher overload warning', desc: 'Warn me when a teacher exceeds the weekly workload limit.' },
  { key: 'weeklyDigest', label: 'Weekly email digest', desc: 'Receive a Monday summary of schedules and workload.' }
]

export default function DosSettings() {
  const authStore = useAuthStore()
  const [tab, setTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [profile, setProfile] = useState({
    name: authStore.user?.name || authStore.user?.full_name || '',
    email: authStore.user?.email || '',
    phone: authStore.user?.phone || '',
    profile_photo: authStore.user?.profile_photo || ''
  })
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [constraints, setConstraints] = useState({
    max_periods_per_day: 8,
    max_consecutive_periods: 3,
    max_teacher_periods_per_day: 6,
    allow_saturday: 0
  })
  const [prefs, setPrefs] = useState(() =>
    JSON.parse(
      localStorage.getItem('dos-notif-prefs') ||
        '{"timetablePublished":true,"conflictDetected":true,"overloadWarning":true,"weeklyDigest":false}'
    )
  )
  const [errors, setErrors] = useState({})

  useEffect(() => {
    ;(async () => {
      try {
        const data = await dosActions.getConstraints()
        setConstraints((prev) => ({ ...prev, ...data }))
      } catch {
        /* defaults */
      }
    })()
  }, [])

  function togglePref(key) {
    const nextPrefs = { ...prefs, [key]: !prefs[key] }
    setPrefs(nextPrefs)
    localStorage.setItem('dos-notif-prefs', JSON.stringify(nextPrefs))
    dosActions.success('Notification preference saved.')
  }

  async function saveProfile() {
    const nextErrors = {}
    if (profile.name.length < 3) nextErrors.name = 'Full name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) nextErrors.email = 'Enter a valid email address.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      const result = await authStore.updateProfile({
        name: profile.name,
        full_name: profile.name,
        email: profile.email,
        phone: profile.phone,
        profile_photo: profile.profile_photo
      }, { showGlobalNotification: false })
      if (!result.success) throw new Error(result.error || 'Profile update failed.')
      dosActions.success('Your profile has been updated.', 'Profile saved')
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setSaving(false)
    }
  }

  async function uploadProfilePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      dosActions.error('Choose an image file.', 'Invalid file')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      dosActions.error('Choose an image smaller than 2 MB.', 'Image is too large')
      event.target.value = ''
      return
    }

    setUploadingPhoto(true)
    try {
      const payload = new FormData()
      payload.append('photo', file)
      const response = await api.post('/upload/profile-photo', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setProfileField('profile_photo', response.data.photo?.path || '')
      dosActions.success('Photo uploaded. Save your profile to apply it.', 'Photo ready')
    } catch (error) {
      dosActions.error(error.response?.data?.message || 'Photo upload failed.', 'Upload failed')
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  async function changePassword() {
    const nextErrors = {}
    if (!pwd.current) nextErrors.current = 'Enter your current password.'
    if (pwd.next.length < 8) nextErrors.next = 'Use at least 8 characters.'
    if (pwd.confirm !== pwd.next) nextErrors.confirm = 'Passwords do not match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword: pwd.current,
        newPassword: pwd.next
      }, { showGlobalNotification: false })
      setPwd({ current: '', next: '', confirm: '' })
      setErrors({})
      dosActions.success(response.data.message || 'Your password has been changed.', 'Security updated')
    } catch (error) {
      dosActions.apiError(error, 'Password could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  async function saveConstraints() {
    setSaving(true)
    try {
      await dosActions.saveConstraints({ ...constraints })
      dosActions.success('Scheduling constraints saved — they apply to the next generation.', 'Constraints saved')
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setSaving(false)
    }
  }

  const setProfileField = (key, value) => setProfile((prev) => ({ ...prev, [key]: value }))
  const setPwdField = (key, value) => setPwd((prev) => ({ ...prev, [key]: value }))
  const setConstraint = (key, value) => setConstraints((prev) => ({ ...prev, [key]: value }))

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-5">
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Settings</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            Your account, security, notifications and scheduling constraints.
          </p>
        </div>

        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={`sa-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* PROFILE */}
        {tab === 'profile' ? (
          <form
            className="sa-card p-5 sm:p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              saveProfile()
            }}
          >
            <h3 className="sa-card-title">
              <CircleUserRound size={16} style={{ color: 'var(--panta-teal)' }} /> Profile
            </h3>
            <div className="dos-profile-photo-row">
              <div className="dos-profile-photo">
                {profile.profile_photo ? (
                  <img src={resolveAssetUrl(profile.profile_photo)} alt="Profile" />
                ) : (
                  <span>{(profile.name || profile.email || 'D').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="dos-profile-photo-copy">
                <strong>Profile photo</strong>
                <span>Use a clear image so your colleagues can recognize you.</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <label className="sa-btn soft sm dos-photo-upload" aria-disabled={uploadingPhoto}>
                    {uploadingPhoto ? <LoaderCircle size={14} className="animate-spin" /> : <Camera size={14} />}
                    {uploadingPhoto ? 'Uploading…' : 'Choose photo'}
                    <input type="file" accept="image/*" disabled={uploadingPhoto} onChange={uploadProfilePhoto} />
                  </label>
                  {profile.profile_photo ? (
                    <button type="button" className="sa-btn ghost sm" onClick={() => setProfileField('profile_photo', '')}>
                      <X size={14} /> Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div>
              <label className="sa-label" htmlFor="ds-name">
                Full name <span className="req">*</span>
              </label>
              <input
                id="ds-name"
                value={profile.name}
                onChange={(event) => setProfileField('name', event.target.value.trim())}
                className={`sa-input ${errors.name ? 'err' : ''}`}
              />
              {errors.name ? <p className="sa-err">{errors.name}</p> : null}
            </div>
            <div>
              <label className="sa-label" htmlFor="ds-email">
                Email <span className="req">*</span>
              </label>
              <input
                id="ds-email"
                value={profile.email}
                onChange={(event) => setProfileField('email', event.target.value.trim())}
                type="email"
                className={`sa-input ${errors.email ? 'err' : ''}`}
              />
              {errors.email ? <p className="sa-err">{errors.email}</p> : null}
            </div>
            <div>
              <label className="sa-label" htmlFor="ds-phone">
                Phone
              </label>
              <input
                id="ds-phone"
                value={profile.phone}
                onChange={(event) => setProfileField('phone', event.target.value.trim())}
                className="sa-input"
                placeholder="+250 7…"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button type="submit" className="sa-btn primary panta-primary-btn" disabled={saving}>
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : null} Save profile
              </button>
            </div>
          </form>
        ) : null}

        {/* SECURITY */}
        {tab === 'security' ? (
          <form
            className="sa-card p-5 sm:p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              changePassword()
            }}
          >
            <h3 className="sa-card-title">
              <KeyRound size={16} style={{ color: 'var(--panta-teal)' }} /> Change Password
            </h3>
            <div>
              <label className="sa-label" htmlFor="sec-cur">
                Current password <span className="req">*</span>
              </label>
              <input
                id="sec-cur"
                value={pwd.current}
                onChange={(event) => setPwdField('current', event.target.value)}
                type="password"
                autoComplete="current-password"
                className={`sa-input ${errors.current ? 'err' : ''}`}
              />
              {errors.current ? <p className="sa-err">{errors.current}</p> : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="sa-label" htmlFor="sec-new">
                  New password <span className="req">*</span>
                </label>
                <input
                  id="sec-new"
                  value={pwd.next}
                  onChange={(event) => setPwdField('next', event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className={`sa-input ${errors.next ? 'err' : ''}`}
                />
                <PasswordStrength password={pwd.next} />
                {errors.next ? <p className="sa-err">{errors.next}</p> : null}
              </div>
              <div>
                <label className="sa-label" htmlFor="sec-conf">
                  Confirm new password <span className="req">*</span>
                </label>
                <input
                  id="sec-conf"
                  value={pwd.confirm}
                  onChange={(event) => setPwdField('confirm', event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className={`sa-input ${errors.confirm ? 'err' : ''}`}
                />
                {errors.confirm ? <p className="sa-err">{errors.confirm}</p> : null}
              </div>
            </div>
            <div
              className="rounded-xl border border-[var(--panta-border)] bg-[#f8fafd] px-4 py-3 text-[12.5px]"
              style={{ color: 'var(--panta-muted)' }}
            >
              Use at least 8 characters with a mix of letters, numbers and symbols.
            </div>
            <div className="flex justify-end pt-1">
              <button type="submit" className="sa-btn primary panta-primary-btn" disabled={saving}>
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : null} Update password
              </button>
            </div>
          </form>
        ) : null}

        {/* NOTIFICATIONS */}
        {tab === 'notifications' ? (
          <div className="sa-card divide-y divide-[#f0f4fa]">
            {notifPrefs.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--panta-text)' }}>
                    {p.label}
                  </p>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
                    {p.desc}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[p.key]}
                  aria-label={p.label}
                  className={`relative w-11 h-6 rounded-full transition shrink-0 ${prefs[p.key] ? 'panta-primary-btn' : 'bg-[#d5e0ef]'}`}
                  onClick={() => togglePref(p.key)}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      prefs[p.key] ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* CONSTRAINTS */}
        {tab !== 'profile' && tab !== 'security' && tab !== 'notifications' ? (
          <form
            className="sa-card p-5 sm:p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              saveConstraints()
            }}
          >
            <h3 className="sa-card-title">
              <SlidersHorizontal size={16} style={{ color: 'var(--panta-teal)' }} /> Scheduling Constraints
            </h3>
            <p className="text-[12.5px]" style={{ color: 'var(--panta-muted)' }}>
              Hard rules respected by the timetable generator.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="sa-label" htmlFor="cs-day">
                  Max periods / class / day
                </label>
                <input
                  id="cs-day"
                  value={constraints.max_periods_per_day}
                  onChange={(event) => setConstraint('max_periods_per_day', Number(event.target.value))}
                  type="number"
                  min="4"
                  max="10"
                  className="sa-input"
                />
              </div>
              <div>
                <label className="sa-label" htmlFor="cs-cons">
                  Max consecutive lessons
                </label>
                <input
                  id="cs-cons"
                  value={constraints.max_consecutive_periods}
                  onChange={(event) => setConstraint('max_consecutive_periods', Number(event.target.value))}
                  type="number"
                  min="1"
                  max="6"
                  className="sa-input"
                />
              </div>
              <div>
                <label className="sa-label" htmlFor="cs-tday">
                  Max periods / teacher / day
                </label>
                <input
                  id="cs-tday"
                  value={constraints.max_teacher_periods_per_day}
                  onChange={(event) => setConstraint('max_teacher_periods_per_day', Number(event.target.value))}
                  type="number"
                  min="2"
                  max="10"
                  className="sa-input"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--panta-border)] px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#0F9D8A]"
                checked={!!Number(constraints.allow_saturday)}
                onChange={(event) => setConstraint('allow_saturday', event.target.checked ? 1 : 0)}
              />
              <span className="text-[13.5px]" style={{ color: 'var(--panta-text)' }}>
                <span className="font-semibold">Include Saturday</span>
                <span className="block text-[12px]" style={{ color: 'var(--panta-muted)' }}>
                  Allow lessons to be scheduled on Saturdays.
                </span>
              </span>
            </label>
            <div className="flex justify-end pt-1">
              <button type="submit" className="sa-btn primary panta-primary-btn" disabled={saving}>
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : null} Save constraints
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
