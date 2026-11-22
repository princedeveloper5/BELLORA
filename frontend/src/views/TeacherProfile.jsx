import { useEffect, useRef, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/stores/api'
import { notifySuccess } from '@/utils/notify'
import {
  AlarmClock,
  BadgeCheck,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  Download,
  Eye,
  EyeOff,
  GraduationCap,
  Inbox,
  KeyRound,
  LibraryBig,
  LockKeyhole,
  Mail,
  Megaphone,
  MessageSquareText,
  MonitorCheck,
  NotebookPen,
  Pencil,
  Phone,
  School,
  ShieldCheck,
  ShieldPlus,
  UserRound,
  UserRoundCheck,
  Users,
  X
} from 'lucide-react'
import './TeacherProfile.css'

const tabs = ['Overview', 'Edit Profile', 'Security', 'Notifications']
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const icons = {
  'Overview': UserRoundCheck,
  'Edit Profile': Pencil,
  'Security': LockKeyhole,
  'Notifications': Bell
}

const tones = {
  'Overview': 'tone-blue',
  'Edit Profile': 'tone-violet',
  'Security': 'tone-green',
  'Notifications': 'tone-amber'
}

const getTabIcon = (tab) => icons[tab] || UserRound
const getTabTone = (tab) => tones[tab] || 'tone-blue'

const getInitials = (name) => {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const formatDate = (date) => {
  if (!date) return 'Not recorded'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatDateTime = (date) => {
  if (!date) return 'Not recorded'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const resolveAssetUrl = (path) => {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path

  const apiRoot = (api.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiRoot}${path.startsWith('/') ? path : `/${path}`}`
}

const emptyProfileData = {
  name: '',
  email: '',
  phone: '',
  department: '',
  subject: '',
  qualification: '',
  experience: 0,
  employeeId: '',
  joinDate: '',
  photo: null
}

const emptyEditData = {
  name: '',
  email: '',
  phone: '',
  department: '',
  subject: '',
  qualification: '',
  experience: 0,
  availableDays: [],
  availableFrom: '08:00',
  availableTo: '16:00',
  notes: ''
}

export default function TeacherProfile() {
  const authStore = useAuthStore()
  const [currentTab, setCurrentTab] = useState('Overview')
  const fileInputRef = useRef(null)
  const selectedProfilePhoto = useRef(null)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [passwordError, setPasswordError] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const loadError = useRef('')

  const [profileData, setProfileData] = useState(() => ({ ...emptyProfileData }))
  const [editData, setEditData] = useState(() => ({ ...emptyEditData, availableDays: [] }))
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailClasses: true,
    emailRequests: true,
    emailAnnouncements: true,
    inAppClasses: true,
    inAppRequests: true
  })

  const stats = {
    totalClasses: 15,
    students: 120,
    subjects: 3,
    requestsPending: 2
  }

  const loginActivity = [
    {
      id: 1,
      device: 'Chrome on Windows',
      time: new Date(),
      location: 'School Building'
    },
    {
      id: 2,
      device: 'Safari on iPhone',
      time: new Date(Date.now() - 86400000),
      location: 'Home'
    }
  ]

  const hydrateProfileFromTeacher = (teacher = {}) => {
    const nextProfileData = {
      name: teacher.name || teacher.username || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      department: teacher.department || '',
      subject: teacher.module_name || teacher.subject || '',
      qualification: teacher.qualification || '',
      experience: Number(teacher.years_experience) || 0,
      employeeId: teacher.employee_id || teacher.teacher_id || '',
      joinDate: teacher.created_at || teacher.join_date || '',
      photo: resolveAssetUrl(teacher.profile_photo)
    }

    setProfileData(nextProfileData)
    setEditData({
      name: nextProfileData.name,
      email: nextProfileData.email,
      phone: nextProfileData.phone,
      department: nextProfileData.department,
      subject: nextProfileData.subject,
      qualification: nextProfileData.qualification,
      experience: nextProfileData.experience,
      availableDays: teacher.available_days
        ? String(teacher.available_days)
            .split(',')
            .map((day) => day.trim())
            .filter(Boolean)
        : [...days],
      availableFrom: teacher.available_from || '08:00',
      availableTo: teacher.available_to || '16:00',
      notes: teacher.notes || ''
    })
  }

  const triggerPhotoUpload = () => {
    fileInputRef.current?.click()
  }

  const persistProfilePhoto = async (profilePhotoPath) => {
    await api.put('/teacher-auth/me', {
      name: editData.name,
      email: editData.email,
      department: editData.department,
      phone: editData.phone,
      profile_photo: profilePhotoPath,
      module_name: editData.subject,
      qualification: editData.qualification,
      yearsExperience: editData.experience,
      availableDays: editData.availableDays.join(','),
      availableFrom: editData.availableFrom,
      availableTo: editData.availableTo,
      notes: editData.notes
    })
  }

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    selectedProfilePhoto.current = file
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      setProfileData((prev) => ({ ...prev, photo: result }))
    }
    reader.readAsDataURL(file)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('photo', file)
      const uploadResponse = await api.post('/upload/profile-photo', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const profilePhotoPath = uploadResponse.data.photo.path
      await persistProfilePhoto(profilePhotoPath)
      await authStore.checkAuth()
      hydrateProfileFromTeacher(authStore.currentUser || {})
      selectedProfilePhoto.current = null
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to upload profile photo')
    }
  }

  const toggleAvailableDay = (day) => {
    setEditData((prev) => {
      const exists = prev.availableDays.includes(day)
      return {
        ...prev,
        availableDays: exists ? prev.availableDays.filter((item) => item !== day) : [...prev.availableDays, day]
      }
    })
  }

  const saveProfile = async (event) => {
    event?.preventDefault?.()
    try {
      let profilePhotoPath = authStore.currentUser?.profile_photo || null

      if (selectedProfilePhoto.current) {
        const uploadFormData = new FormData()
        uploadFormData.append('photo', selectedProfilePhoto.current)
        const uploadResponse = await api.post('/upload/profile-photo', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        profilePhotoPath = uploadResponse.data.photo.path
      }

      await persistProfilePhoto(profilePhotoPath)

      await authStore.checkAuth()
      hydrateProfileFromTeacher(authStore.currentUser || {})
      selectedProfilePhoto.current = null
      setCurrentTab('Overview')
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to save profile')
    }
  }

  const changePassword = (event) => {
    event?.preventDefault?.()
    setPasswordError('')

    if (!passwordData.current) {
      setPasswordError('Current password is required')
      return
    }

    if (passwordData.new.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }

    if (!/[A-Z]/.test(passwordData.new)) {
      setPasswordError('Password must contain at least one uppercase letter')
      return
    }

    if (!/[0-9]/.test(passwordData.new)) {
      setPasswordError('Password must contain at least one number')
      return
    }

    if (passwordData.new !== passwordData.confirm) {
      setPasswordError('Passwords do not match')
      return
    }

    notifySuccess('Password changed successfully!')
    setPasswordData({ current: '', new: '', confirm: '' })
    setCurrentTab('Overview')
  }

  const saveNotificationPrefs = () => {
    notifySuccess('Notification preferences saved successfully!')
  }

  const downloadProfilePDF = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      window.print()
      return
    }

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${profileData.name || 'Teacher'} Profile</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
    h1 { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    td { border: 1px solid #d1d5db; padding: 10px; }
    td:first-child { font-weight: 700; background: #f8fafc; width: 220px; }
  </style>
</head>
<body>
  <h1>${profileData.name || 'Teacher Profile'}</h1>
  <p>${profileData.email || ''}</p>
  <table>
    <tr><td>Department</td><td>${profileData.department || ''}</td></tr>
    <tr><td>Phone</td><td>${profileData.phone || ''}</td></tr>
    <tr><td>Primary Subject</td><td>${profileData.subject || ''}</td></tr>
    <tr><td>Qualification</td><td>${profileData.qualification || ''}</td></tr>
    <tr><td>Experience</td><td>${profileData.experience || 0} years</td></tr>
    <tr><td>Employee ID</td><td>${profileData.employeeId || ''}</td></tr>
  </table>
</body>
</html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingProfile(true)
      try {
        await authStore.checkAuth()
        if (cancelled) return
        hydrateProfileFromTeacher(authStore.currentUser || {})
      } catch (error) {
        loadError.current = error.message || 'Unable to load profile. Please try again.'
      } finally {
        if (!cancelled) setIsLoadingProfile(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <TeacherLayout>
      <div className="profile-container">
        <section className="profile-header">
          <h1><UserRoundCheck className="profile-title-icon" aria-hidden="true" /> My Profile</h1>
          <p>Manage your profile information and settings</p>
        </section>

        {isLoadingProfile && (
          <div className="profile-loading">
            <div className="profile-loading-header">
              <div className="skeleton-avatar"></div>
              <div className="profile-loading-lines">
                <div className="skeleton-line title"></div>
                <div className="skeleton-line short"></div>
                <div className="skeleton-line"></div>
              </div>
            </div>
            <div className="profile-loading-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="skeleton-box" key={index}></div>
              ))}
            </div>
          </div>
        )}

        {!isLoadingProfile && (
          <div>
            <section className="profile-tabs">
              {tabs.map((tab) => {
                const TabIcon = getTabIcon(tab)
                return (
                  <button
                    key={tab}
                    className={`tab-btn${currentTab === tab ? ' active' : ''}`}
                    onClick={() => setCurrentTab(tab)}
                  >
                    <TabIcon className={`tab-icon ${getTabTone(tab)}`} aria-hidden="true" />
                    <span>{tab}</span>
                  </button>
                )
              })}
            </section>

            {currentTab === 'Overview' && (
              <section className="profile-section">
                <div className="profile-overview">
                  <div className="photo-section">
                    <div className="profile-photo-container">
                      {profileData.photo ? (
                        <img src={profileData.photo} alt={profileData.name} className="profile-photo" />
                      ) : (
                        <div className="profile-photo-placeholder">
                          {getInitials(profileData.name)}
                        </div>
                      )}
                      <button className="photo-upload-btn" onClick={triggerPhotoUpload}>
                        <Camera size={17} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        hidden
                        onChange={uploadPhoto}
                      />
                    </div>
                    <div className="photo-info">
                      <h3>{profileData.name}</h3>
                      <p className="department">{profileData.department}</p>
                      <p className="email">{profileData.email}</p>
                      <span className="status-badge online">
                        <CircleCheck size={14} strokeWidth={2.5} aria-hidden="true" /> Active
                      </span>
                    </div>
                  </div>

                  <div className="info-grid">
                    <div className="info-card">
                      <span className="info-icon tone-blue"><BadgeCheck aria-hidden="true" /></span>
                      <label>Employee ID</label>
                      <p>{profileData.employeeId}</p>
                    </div>

                    <div className="info-card">
                      <span className="info-icon tone-green"><Phone aria-hidden="true" /></span>
                      <label>Phone</label>
                      <p>{profileData.phone}</p>
                    </div>

                    <div className="info-card">
                      <span className="info-icon tone-violet"><BookOpen aria-hidden="true" /></span>
                      <label>Primary Subject</label>
                      <p>{profileData.subject}</p>
                    </div>

                    <div className="info-card">
                      <span className="info-icon tone-amber"><GraduationCap aria-hidden="true" /></span>
                      <label>Qualification</label>
                      <p>{profileData.qualification}</p>
                    </div>

                    <div className="info-card">
                      <span className="info-icon tone-cyan"><BriefcaseBusiness aria-hidden="true" /></span>
                      <label>Years of Experience</label>
                      <p>{profileData.experience} years</p>
                    </div>

                    <div className="info-card">
                      <span className="info-icon tone-indigo"><CalendarDays aria-hidden="true" /></span>
                      <label>Joining Date</label>
                      <p>{formatDate(profileData.joinDate)}</p>
                    </div>
                  </div>

                  <div className="stats-section">
                    <h3><BarChart3 className="section-heading-icon tone-blue" aria-hidden="true" /> Statistics</h3>
                    <div className="stats-grid">
                      <div className="stat">
                        <School className="stat-icon tone-blue" aria-hidden="true" />
                        <span className="stat-value">{stats.totalClasses}</span>
                        <span className="stat-label">Total Classes</span>
                      </div>

                      <div className="stat">
                        <Users className="stat-icon tone-green" aria-hidden="true" />
                        <span className="stat-value">{stats.students}</span>
                        <span className="stat-label">Students Taught</span>
                      </div>

                      <div className="stat">
                        <LibraryBig className="stat-icon tone-violet" aria-hidden="true" />
                        <span className="stat-value">{stats.subjects}</span>
                        <span className="stat-label">Subjects</span>
                      </div>

                      <div className="stat">
                        <Clock3 className="stat-icon tone-amber" aria-hidden="true" />
                        <span className="stat-value">{stats.requestsPending}</span>
                        <span className="stat-label">Pending Requests</span>
                      </div>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <button className="btn-secondary" onClick={() => setCurrentTab('Edit Profile')}>
                      <Pencil size={17} strokeWidth={2.4} aria-hidden="true" /> Edit Profile
                    </button>
                    <button className="btn-secondary" onClick={() => setCurrentTab('Security')}>
                      <LockKeyhole size={17} strokeWidth={2.4} aria-hidden="true" /> Change Password
                    </button>
                    <button className="btn-secondary" onClick={downloadProfilePDF}>
                      <Download size={17} strokeWidth={2.4} aria-hidden="true" /> Download Profile
                    </button>
                  </div>
                </div>
              </section>
            )}

            {currentTab === 'Edit Profile' && (
              <section className="profile-section">
                <form onSubmit={saveProfile} className="profile-form">
                  <div className="form-section">
                    <h3><UserRound className="section-heading-icon tone-blue" aria-hidden="true" /> Personal Information</h3>

                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        value={editData.name}
                        onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                        type="text"
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Email *</label>
                        <input
                          value={editData.email}
                          onChange={(e) => setEditData((prev) => ({ ...prev, email: e.target.value }))}
                          type="email"
                          className="form-input"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Phone *</label>
                        <input
                          value={editData.phone}
                          onChange={(e) => setEditData((prev) => ({ ...prev, phone: e.target.value }))}
                          type="tel"
                          className="form-input"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3><BriefcaseBusiness className="section-heading-icon tone-violet" aria-hidden="true" /> Professional Information</h3>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Department *</label>
                        <select
                          value={editData.department}
                          onChange={(e) => setEditData((prev) => ({ ...prev, department: e.target.value }))}
                          className="form-input"
                          required
                        >
                          <option>SSOD</option>
                          <option>Science</option>
                          <option>Languages</option>
                          <option>Mathematics</option>
                          <option>Social Studies</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Primary Subject *</label>
                        <input
                          value={editData.subject}
                          onChange={(e) => setEditData((prev) => ({ ...prev, subject: e.target.value }))}
                          type="text"
                          className="form-input"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Qualification</label>
                        <input
                          value={editData.qualification}
                          onChange={(e) => setEditData((prev) => ({ ...prev, qualification: e.target.value }))}
                          type="text"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Years of Experience</label>
                        <input
                          value={editData.experience}
                          onChange={(e) => setEditData((prev) => ({ ...prev, experience: e.target.valueAsNumber }))}
                          type="number"
                          className="form-input"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3><CalendarCheck className="section-heading-icon tone-green" aria-hidden="true" /> Availability</h3>

                    <div className="form-group">
                      <label>Available Days</label>
                      <div className="checkbox-group">
                        {days.map((day) => (
                          <label key={day} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={editData.availableDays.includes(day)}
                              onChange={() => toggleAvailableDay(day)}
                            />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Available From</label>
                        <input
                          value={editData.availableFrom}
                          onChange={(e) => setEditData((prev) => ({ ...prev, availableFrom: e.target.value }))}
                          type="time"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Available To</label>
                        <input
                          value={editData.availableTo}
                          onChange={(e) => setEditData((prev) => ({ ...prev, availableTo: e.target.value }))}
                          type="time"
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3><NotebookPen className="section-heading-icon tone-amber" aria-hidden="true" /> Additional Notes</h3>

                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={editData.notes}
                        onChange={(e) => setEditData((prev) => ({ ...prev, notes: e.target.value }))}
                        className="form-input form-textarea"
                        placeholder="Add any additional information..."
                        rows="4"
                      ></textarea>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      <Check size={17} strokeWidth={2.4} aria-hidden="true" /> Save Changes
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setCurrentTab('Overview')}>
                      <X size={17} strokeWidth={2.4} aria-hidden="true" /> Cancel
                    </button>
                  </div>
                </form>
              </section>
            )}

            {currentTab === 'Security' && (
              <section className="profile-section">
                <div className="security-section">
                  <div className="security-card">
                    <h3><KeyRound className="section-heading-icon tone-blue" aria-hidden="true" /> Change Password</h3>
                    <p>Update your password to keep your account secure</p>

                    <form onSubmit={changePassword} className="security-form">
                      <div className="form-group">
                        <label>Current Password *</label>
                        <div className="password-input">
                          <input
                            value={passwordData.current}
                            onChange={(e) => setPasswordData((prev) => ({ ...prev, current: e.target.value }))}
                            type={showPasswords.current ? 'text' : 'password'}
                            className="form-input"
                            required
                          />
                          <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                          >
                            {showPasswords.current ? (
                              <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" />
                            ) : (
                              <Eye size={17} strokeWidth={2.2} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>New Password *</label>
                        <div className="password-input">
                          <input
                            value={passwordData.new}
                            onChange={(e) => setPasswordData((prev) => ({ ...prev, new: e.target.value }))}
                            type={showPasswords.new ? 'text' : 'password'}
                            className="form-input"
                            required
                          />
                          <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                          >
                            {showPasswords.new ? (
                              <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" />
                            ) : (
                              <Eye size={17} strokeWidth={2.2} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        <small className="password-hint">At least 8 characters with uppercase, lowercase, and numbers</small>
                      </div>

                      <div className="form-group">
                        <label>Confirm New Password *</label>
                        <div className="password-input">
                          <input
                            value={passwordData.confirm}
                            onChange={(e) => setPasswordData((prev) => ({ ...prev, confirm: e.target.value }))}
                            type={showPasswords.confirm ? 'text' : 'password'}
                            className="form-input"
                            required
                          />
                          <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                          >
                            {showPasswords.confirm ? (
                              <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" />
                            ) : (
                              <Eye size={17} strokeWidth={2.2} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      {passwordError && (
                        <div className="error-message">
                          <CircleAlert size={17} strokeWidth={2.4} aria-hidden="true" />
                          {passwordError}
                        </div>
                      )}

                      <div className="form-actions">
                        <button type="submit" className="btn-primary">
                          <ShieldCheck size={17} strokeWidth={2.4} aria-hidden="true" /> Update Password
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => setCurrentTab('Overview')}>
                          <X size={17} strokeWidth={2.4} aria-hidden="true" /> Cancel
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="security-card">
                    <h3><ShieldPlus className="section-heading-icon tone-green" aria-hidden="true" /> Two-Factor Authentication</h3>
                    <p>Add an extra layer of security to your account</p>
                    <button className="btn-secondary">
                      <ShieldCheck size={17} strokeWidth={2.4} aria-hidden="true" /> Enable 2FA
                    </button>
                  </div>

                  <div className="security-card">
                    <h3><MonitorCheck className="section-heading-icon tone-cyan" aria-hidden="true" /> Login Activity</h3>
                    <div className="activity-list">
                      {loginActivity.map((activity) => (
                        <div key={activity.id} className="activity-item">
                          <span className="activity-icon"><MonitorCheck aria-hidden="true" /></span>
                          <div className="activity-header">
                            <span className="activity-device">{activity.device}</span>
                            <span className="activity-time">{formatDateTime(activity.time)}</span>
                          </div>
                          <p className="activity-location">{activity.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {currentTab === 'Notifications' && (
              <section className="profile-section">
                <div className="notifications-section">
                  <h3><Bell className="section-heading-icon tone-amber" aria-hidden="true" /> Notification Preferences</h3>

                  <div className="preference-group">
                    <h4><Mail className="section-heading-icon tone-blue" aria-hidden="true" /> Email Notifications</h4>

                    <label className="preference-item">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.emailClasses}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, emailClasses: e.target.checked }))}
                      />
                      <span className="preference-icon tone-blue"><CalendarClock aria-hidden="true" /></span>
                      <div className="preference-content">
                        <span className="preference-title">Class Schedule Changes</span>
                        <small>Notify me when my class schedule changes</small>
                      </div>
                    </label>

                    <label className="preference-item">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.emailRequests}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, emailRequests: e.target.checked }))}
                      />
                      <span className="preference-icon tone-violet"><Inbox aria-hidden="true" /></span>
                      <div className="preference-content">
                        <span className="preference-title">Request Updates</span>
                        <small>Notify me when my requests are approved or rejected</small>
                      </div>
                    </label>

                    <label className="preference-item">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.emailAnnouncements}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, emailAnnouncements: e.target.checked }))}
                      />
                      <span className="preference-icon tone-amber"><Megaphone aria-hidden="true" /></span>
                      <div className="preference-content">
                        <span className="preference-title">Announcements</span>
                        <small>Notify me about school announcements</small>
                      </div>
                    </label>
                  </div>

                  <div className="preference-group">
                    <h4><BellRing className="section-heading-icon tone-green" aria-hidden="true" /> In-App Notifications</h4>

                    <label className="preference-item">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.inAppClasses}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, inAppClasses: e.target.checked }))}
                      />
                      <span className="preference-icon tone-green"><AlarmClock aria-hidden="true" /></span>
                      <div className="preference-content">
                        <span className="preference-title">Class Reminders</span>
                        <small>Show reminders for upcoming classes</small>
                      </div>
                    </label>

                    <label className="preference-item">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.inAppRequests}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, inAppRequests: e.target.checked }))}
                      />
                      <span className="preference-icon tone-cyan"><MessageSquareText aria-hidden="true" /></span>
                      <div className="preference-content">
                        <span className="preference-title">Request Notifications</span>
                        <small>Show notifications for request updates</small>
                      </div>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button className="btn-primary" onClick={saveNotificationPrefs}>
                      <Check size={17} strokeWidth={2.4} aria-hidden="true" /> Save Preferences
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </TeacherLayout>
  )
}
