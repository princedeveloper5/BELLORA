import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import api from '@/stores/api'
import TeacherLayout from '@/components/TeacherLayout'
import {
  Bell,
  CalendarCheck,
  Eye,
  EyeOff,
  ShieldCheck,
  Table2,
  UserRound,
  UserRoundCog
} from 'lucide-react'
import './TeacherSettings.css'

const teacherPreferencesKey = 'teacherSettingsPreferences'

const settingsSections = [
  { id: 'account', label: 'Account', caption: 'Profile basics', icon: UserRoundCog, tone: 'violet' },
  { id: 'availability', label: 'Availability', caption: 'Teaching hours', icon: CalendarCheck, tone: 'green' },
  { id: 'timetable', label: 'Timetable', caption: 'View options', icon: Table2, tone: 'blue' },
  { id: 'notifications', label: 'Notifications', caption: 'Reminders', icon: Bell, tone: 'amber' },
  { id: 'security', label: 'Security', caption: 'Password', icon: ShieldCheck, tone: 'teal' }
]

const defaultPreferences = {
  defaultTimetableView: 'week',
  timeFormat: '24',
  highlightToday: true,
  showRoomCodes: true,
  compactTimetable: false,
  lessonReminders: true,
  reminderMinutes: 10,
  weekendQuietMode: true
}

const availableDaysOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const emptyProfileData = {
  name: '',
  email: '',
  department: '',
  phone: '',
  employee_id: '',
  module_name: '',
  qualification: '',
  years_experience: 0,
  profile_photo: '',
  receive_schedule_alerts: true
}

const emptyFormData = {
  available_days: '',
  available_from: '',
  available_to: '',
  notes: ''
}

const emptyMessages = {
  profile: '',
  availability: '',
  password: '',
  preferences: ''
}

export default function TeacherSettings() {
  const authStore = useAuthStore()

  const [activeTab, setActiveTab] = useState('account')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [settingsError, setSettingsError] = useState('')

  const [profileData, setProfileData] = useState(() => ({ ...emptyProfileData }))
  const [formData, setFormData] = useState(() => ({ ...emptyFormData }))
  const [preferences, setPreferences] = useState({ ...defaultPreferences })
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [messages, setMessages] = useState(() => ({ ...emptyMessages }))
  const [originalFormData, setOriginalFormData] = useState({})

  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const messagesClass = {
    profile: messages.profile.includes('successfully') ? 'alert-success' : 'alert-danger',
    availability: messages.availability.includes('successfully') ? 'alert-success' : 'alert-danger',
    password: messages.password.includes('successfully') ? 'alert-success' : 'alert-danger'
  }

  const profileInitial = profileData.name?.charAt(0)?.toUpperCase() || 'T'

  const availableDaysArray = formData.available_days ? formData.available_days.split(', ') : []

  const loadPreferences = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(teacherPreferencesKey) || '{}')
      setPreferences({ ...defaultPreferences, ...saved })
    } catch (error) {
      setPreferences({ ...defaultPreferences })
    }
  }

  const savePreferences = () => {
    localStorage.setItem(teacherPreferencesKey, JSON.stringify(preferences))
    setMessages((prev) => ({ ...prev, preferences: 'Preferences saved on this device.' }))
    window.setTimeout(() => {
      setMessages((prev) => ({ ...prev, preferences: '' }))
    }, 2200)
  }

  const patchPreferences = (patch) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(teacherPreferencesKey, JSON.stringify(next))
      setMessages((prevMessages) => ({ ...prevMessages, preferences: 'Preferences saved on this device.' }))
      window.setTimeout(() => {
        setMessages((prevMessages) => ({ ...prevMessages, preferences: '' }))
      }, 2200)
      return next
    })
  }

  const loadTeacherData = async () => {
    setLoadingData(true)
    setSettingsError('')
    try {
      const response = await api.get('/teacher-auth/me')
      const teacher = response.data.teacher

      setProfileData({
        name: teacher.name || '',
        email: teacher.email || '',
        department: teacher.department || '',
        phone: teacher.phone || '',
        employee_id: teacher.employee_id || '',
        module_name: teacher.module_name || '',
        qualification: teacher.qualification || '',
        years_experience: teacher.years_experience || 0,
        profile_photo: teacher.profile_photo || '',
        receive_schedule_alerts: teacher.receive_schedule_alerts ?? true
      })

      const nextFormData = {
        available_days: teacher.available_days || '',
        available_from: teacher.available_from || '',
        available_to: teacher.available_to || '',
        notes: teacher.notes || ''
      }

      setFormData(nextFormData)
      setOriginalFormData(JSON.parse(JSON.stringify(nextFormData)))
    } catch (error) {
      console.error('Failed to load teacher data:', error)
      setSettingsError(error.response?.data?.message || 'Failed to load settings data')
    } finally {
      setLoadingData(false)
    }
  }

  const saveAvailability = async (event) => {
    event?.preventDefault?.()
    setLoadingAvailability(true)
    setMessages((prev) => ({ ...prev, availability: '' }))

    try {
      await api.put('/teacher-auth/me', {
        availableDays: formData.available_days,
        availableFrom: formData.available_from,
        availableTo: formData.available_to,
        notes: formData.notes
      })

      setOriginalFormData(JSON.parse(JSON.stringify(formData)))
      setMessages((prev) => ({ ...prev, availability: 'Availability updated successfully!' }))
      await authStore.checkAuth()
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        availability: error.response?.data?.message || 'Failed to update availability'
      }))
    } finally {
      setLoadingAvailability(false)
    }
  }

  const saveProfile = async (event) => {
    event?.preventDefault?.()
    setLoadingProfile(true)
    setMessages((prev) => ({ ...prev, profile: '' }))

    try {
      await api.put('/teacher-auth/me', {
        name: profileData.name,
        email: profileData.email,
        department: profileData.department,
        phone: profileData.phone,
        employee_id: profileData.employee_id,
        module_name: profileData.module_name,
        qualification: profileData.qualification,
        yearsExperience: profileData.years_experience,
        profile_photo: profileData.profile_photo,
        receive_schedule_alerts: profileData.receive_schedule_alerts,
        notes: formData.notes,
        availableDays: formData.available_days,
        availableFrom: formData.available_from,
        availableTo: formData.available_to
      })

      setMessages((prev) => ({ ...prev, profile: 'Profile updated successfully!' }))
      await authStore.checkAuth()
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        profile: error.response?.data?.message || 'Failed to update profile'
      }))
    } finally {
      setLoadingProfile(false)
    }
  }

  const toggleScheduleAlerts = (checked) => {
    setLoadingProfile(true)
    const nextProfileData = { ...profileData, receive_schedule_alerts: checked }
    setProfileData(nextProfileData)
    setMessages((prev) => ({ ...prev, profile: '' }))

    api
      .put('/teacher-auth/me', {
        name: nextProfileData.name,
        email: nextProfileData.email,
        department: nextProfileData.department,
        phone: nextProfileData.phone,
        employee_id: nextProfileData.employee_id,
        module_name: nextProfileData.module_name,
        qualification: nextProfileData.qualification,
        yearsExperience: nextProfileData.years_experience,
        profile_photo: nextProfileData.profile_photo,
        receive_schedule_alerts: nextProfileData.receive_schedule_alerts,
        notes: formData.notes,
        availableDays: formData.available_days,
        availableFrom: formData.available_from,
        availableTo: formData.available_to
      })
      .then(() => {
        setMessages((prev) => ({ ...prev, profile: 'Profile updated successfully!' }))
        return authStore.checkAuth()
      })
      .catch((error) => {
        setMessages((prev) => ({
          ...prev,
          profile: error.response?.data?.message || 'Failed to update profile'
        }))
      })
      .finally(() => {
        setLoadingProfile(false)
      })
  }

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setProfileData((prev) => ({ ...prev, profile_photo: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const savePassword = async (event) => {
    event?.preventDefault?.()
    if (!passwordForm.newPassword) {
      setMessages((prev) => ({ ...prev, password: 'Please enter a new password' }))
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setMessages((prev) => ({ ...prev, password: 'Password must be at least 6 characters' }))
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessages((prev) => ({ ...prev, password: 'Passwords do not match' }))
      return
    }

    setLoadingPassword(true)
    setMessages((prev) => ({ ...prev, password: '' }))

    try {
      await api.put('/teacher-auth/me', {
        password: passwordForm.newPassword
      })

      setMessages((prev) => ({ ...prev, password: 'Password updated successfully!' }))
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      await authStore.checkAuth()
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        password: error.response?.data?.message || 'Failed to update password'
      }))
    } finally {
      setLoadingPassword(false)
    }
  }

  const resetAvailability = () => {
    setFormData({
      available_days: originalFormData.available_days,
      available_from: originalFormData.available_from,
      available_to: originalFormData.available_to,
      notes: originalFormData.notes
    })
    setMessages((prev) => ({ ...prev, availability: '' }))
  }

  const resetProfile = () => {
    loadTeacherData()
    setMessages((prev) => ({ ...prev, profile: '' }))
  }

  const resetPassword = () => {
    setPasswordForm({ newPassword: '', confirmPassword: '' })
    setMessages((prev) => ({ ...prev, password: '' }))
  }

  useEffect(() => {
    loadPreferences()
    loadTeacherData()
  }, [])

  return (
    <TeacherLayout>
      <div className="teacher-settings-page">
        <div className="settings-wrap">
          <header className="settings-intro">
            <div>
              <span className="eyebrow">Teacher Workspace</span>
              <h1>Settings</h1>
              <p>Update your account, teaching availability, timetable view, alerts, and password from one organized place.</p>
            </div>
            <Link to="/teacher/profile" className="profile-link">
              <UserRound size={17} strokeWidth={2.2} aria-hidden="true" />
              My Profile
            </Link>
          </header>

          {loadingData ? (
            <div className="settings-skeleton">
              <div className="skeleton-line title"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-grid">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="skeleton-box" key={index}></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="settings-shell">
              <aside className="settings-nav" aria-label="Teacher settings sections">
                {settingsSections.map((item) => {
                  const ItemIcon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`settings-nav-item${activeTab === item.id ? ' active' : ''}`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <span className={`settings-icon ${item.tone}`}>
                        <ItemIcon size={20} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                      <span>{item.label}</span>
                      <small>{item.caption}</small>
                    </button>
                  )
                })}
              </aside>

              <main className="settings-content">
                {settingsError && (
                  <div className="alert alert-danger">
                    {settingsError}
                  </div>
                )}

                {activeTab === 'account' && (
                  <section className="settings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Account Details</h2>
                        <p>Keep the information your DOS uses to identify you correct.</p>
                      </div>
                      <div className="profile-preview">
                        {profileData.profile_photo ? (
                          <img src={profileData.profile_photo} alt="Teacher avatar" />
                        ) : (
                          <span>{profileInitial}</span>
                        )}
                      </div>
                    </div>

                    <form onSubmit={saveProfile}>
                      <div className="form-grid">
                        <label>
                          <span>Full Name</span>
                          <input
                            value={profileData.name}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value.trim() }))}
                            type="text"
                            className="form-control"
                            required
                          />
                        </label>
                        <label>
                          <span>Email</span>
                          <input
                            value={profileData.email}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value.trim() }))}
                            type="email"
                            className="form-control"
                            required
                          />
                        </label>
                        <label>
                          <span>Department</span>
                          <input
                            value={profileData.department}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, department: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, department: e.target.value.trim() }))}
                            type="text"
                            className="form-control"
                            required
                          />
                        </label>
                        <label>
                          <span>Phone</span>
                          <input
                            value={profileData.phone}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value.trim() }))}
                            type="tel"
                            className="form-control"
                          />
                        </label>
                        <label>
                          <span>Staff ID</span>
                          <input
                            value={profileData.employee_id}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, employee_id: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, employee_id: e.target.value.trim() }))}
                            type="text"
                            className="form-control"
                          />
                        </label>
                        <label>
                          <span>Qualification</span>
                          <input
                            value={profileData.qualification}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, qualification: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, qualification: e.target.value.trim() }))}
                            type="text"
                            className="form-control"
                          />
                        </label>
                        <label>
                          <span>Subject Specialization</span>
                          <input
                            value={profileData.module_name}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, module_name: e.target.value }))}
                            onBlur={(e) => setProfileData((prev) => ({ ...prev, module_name: e.target.value.trim() }))}
                            type="text"
                            className="form-control"
                          />
                        </label>
                        <label>
                          <span>Years of Experience</span>
                          <input
                            value={profileData.years_experience}
                            onChange={(e) =>
                              setProfileData((prev) => ({ ...prev, years_experience: e.target.valueAsNumber }))
                            }
                            type="number"
                            min="0"
                            className="form-control"
                          />
                        </label>
                      </div>

                      <label className="upload-row">
                        <span>Profile Photo</span>
                        <input type="file" accept="image/*" className="form-control" onChange={handleAvatarUpload} />
                      </label>

                      {messages.profile && (
                        <div className={`alert ${messagesClass.profile}`} role="alert">
                          {messages.profile}
                        </div>
                      )}

                      <div className="actions-row">
                        <button type="submit" className="btn btn-primary" disabled={loadingProfile}>
                          {loadingProfile ? 'Saving...' : 'Save Account'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={resetProfile}>Reset</button>
                      </div>
                    </form>
                  </section>
                )}

                {activeTab === 'availability' && (
                  <section className="settings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Availability</h2>
                        <p>Tell the DOS when you can be assigned lessons.</p>
                      </div>
                    </div>

                    <form onSubmit={saveAvailability}>
                      <div className="days-grid">
                        {availableDaysOptions.map((day) => (
                          <label key={day} className="day-chip">
                            <input
                              type="checkbox"
                              value={day}
                              checked={availableDaysArray.includes(day)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...availableDaysArray, day]
                                  : availableDaysArray.filter((item) => item !== day)
                                setFormData((prev) => ({ ...prev, available_days: next.join(', ') }))
                              }}
                            />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>

                      <div className="form-grid compact">
                        <label>
                          <span>Available From</span>
                          <input
                            value={formData.available_from}
                            onChange={(e) => setFormData((prev) => ({ ...prev, available_from: e.target.value }))}
                            type="time"
                            className="form-control"
                          />
                        </label>
                        <label>
                          <span>Available Until</span>
                          <input
                            value={formData.available_to}
                            onChange={(e) => setFormData((prev) => ({ ...prev, available_to: e.target.value }))}
                            type="time"
                            className="form-control"
                          />
                        </label>
                      </div>

                      <label>
                        <span>Planning Notes</span>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                          onBlur={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value.trim() }))}
                          rows="4"
                          className="form-control"
                          placeholder="Room preference, lab needs, duty limits, or other scheduling notes."
                        ></textarea>
                      </label>

                      {messages.availability && (
                        <div className={`alert ${messagesClass.availability}`} role="alert">
                          {messages.availability}
                        </div>
                      )}

                      <div className="actions-row">
                        <button type="submit" className="btn btn-primary" disabled={loadingAvailability}>
                          {loadingAvailability ? 'Saving...' : 'Save Availability'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={resetAvailability}>Cancel</button>
                      </div>
                    </form>
                  </section>
                )}

                {activeTab === 'timetable' && (
                  <section className="settings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Timetable View</h2>
                        <p>Choose how your timetable opens and what details appear.</p>
                      </div>
                      <Link to="/teacher/timetable" className="quick-link">Open Timetable</Link>
                    </div>

                    <div className="preference-grid">
                      <label className="preference-card">
                        <span>Default View</span>
                        <select
                          value={preferences.defaultTimetableView}
                          onChange={(e) => patchPreferences({ defaultTimetableView: e.target.value })}
                          className="form-select"
                        >
                          <option value="week">Weekly grid</option>
                          <option value="day">Today view</option>
                        </select>
                      </label>

                      <label className="preference-card">
                        <span>Time Format</span>
                        <select
                          value={preferences.timeFormat}
                          onChange={(e) => patchPreferences({ timeFormat: e.target.value })}
                          className="form-select"
                        >
                          <option value="24">24-hour</option>
                          <option value="12">12-hour</option>
                        </select>
                      </label>

                      <label className="toggle-card">
                        <input
                          type="checkbox"
                          checked={preferences.highlightToday}
                          onChange={(e) => patchPreferences({ highlightToday: e.target.checked })}
                        />
                        <span>
                          <strong>Highlight today</strong>
                          <small>Make the current day easier to scan.</small>
                        </span>
                      </label>

                      <label className="toggle-card">
                        <input
                          type="checkbox"
                          checked={preferences.showRoomCodes}
                          onChange={(e) => patchPreferences({ showRoomCodes: e.target.checked })}
                        />
                        <span>
                          <strong>Show room codes</strong>
                          <small>Keep classroom information visible in timetable cells.</small>
                        </span>
                      </label>

                      <label className="toggle-card">
                        <input
                          type="checkbox"
                          checked={preferences.compactTimetable}
                          onChange={(e) => patchPreferences({ compactTimetable: e.target.checked })}
                        />
                        <span>
                          <strong>Compact timetable</strong>
                          <small>Use tighter rows when you have many lessons.</small>
                        </span>
                      </label>
                    </div>

                    {messages.preferences && <p className="save-note">{messages.preferences}</p>}
                  </section>
                )}

                {activeTab === 'notifications' && (
                  <section className="settings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Notifications</h2>
                        <p>Control lesson reminders and update alerts on this device.</p>
                      </div>
                    </div>

                    <div className="preference-grid">
                      <label className="toggle-card">
                        <input
                          type="checkbox"
                          checked={profileData.receive_schedule_alerts}
                          onChange={(e) => toggleScheduleAlerts(e.target.checked)}
                        />
                        <span>
                          <strong>Timetable update alerts</strong>
                          <small>Notify me when my schedule changes.</small>
                        </span>
                      </label>

                      <label className="toggle-card">
                        <input
                          type="checkbox"
                          checked={preferences.lessonReminders}
                          onChange={(e) => patchPreferences({ lessonReminders: e.target.checked })}
                        />
                        <span>
                          <strong>Lesson reminders</strong>
                          <small>Remind me before the next lesson begins.</small>
                        </span>
                      </label>

                      <label className="preference-card">
                        <span>Reminder Time</span>
                        <select
                          value={preferences.reminderMinutes}
                          onChange={(e) => patchPreferences({ reminderMinutes: e.target.valueAsNumber })}
                          className="form-select"
                        >
                          <option value={5}>5 minutes before</option>
                          <option value={10}>10 minutes before</option>
                          <option value={15}>15 minutes before</option>
                          <option value={30}>30 minutes before</option>
                        </select>
                      </label>

                      <label className="toggle-card">
                        <input
                          type="checkbox"
                          checked={preferences.weekendQuietMode}
                          onChange={(e) => patchPreferences({ weekendQuietMode: e.target.checked })}
                        />
                        <span>
                          <strong>Weekend quiet mode</strong>
                          <small>Reduce reminders from Friday 6:00 PM to Sunday 6:00 PM.</small>
                        </span>
                      </label>
                    </div>

                    {messages.preferences && <p className="save-note">{messages.preferences}</p>}
                  </section>
                )}

                {activeTab === 'security' && (
                  <section className="settings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Security</h2>
                        <p>Change your password and keep your account protected.</p>
                      </div>
                    </div>

                    <form onSubmit={savePassword}>
                      <div className="security-grid">
                        <label>
                          <span>New Password</span>
                          <div className="password-field">
                            <input
                              value={passwordForm.newPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                              }
                              type={showNewPassword ? 'text' : 'password'}
                              className="form-control"
                              placeholder="Enter new password"
                              minLength="6"
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => setShowNewPassword((prev) => !prev)}
                            >
                              {showNewPassword ? (
                                <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" />
                              ) : (
                                <Eye size={17} strokeWidth={2.2} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </label>

                        <label>
                          <span>Confirm Password</span>
                          <div className="password-field">
                            <input
                              value={passwordForm.confirmPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                              }
                              type={showConfirmPassword ? 'text' : 'password'}
                              className="form-control"
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" />
                              ) : (
                                <Eye size={17} strokeWidth={2.2} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </label>
                      </div>

                      {messages.password && (
                        <div className={`alert ${messagesClass.password}`} role="alert">
                          {messages.password}
                        </div>
                      )}

                      <div className="actions-row">
                        <button type="submit" className="btn btn-primary" disabled={loadingPassword}>
                          {loadingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={resetPassword}>Cancel</button>
                      </div>
                    </form>

                    <div className="security-tips">
                      <h3>Account checklist</h3>
                      <ul>
                        <li>Use a password that is not used on other systems.</li>
                        <li>Contact the DOS if your email or staff ID is wrong.</li>
                        <li>Sign out when using a shared computer.</li>
                      </ul>
                    </div>
                  </section>
                )}
              </main>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  )
}
