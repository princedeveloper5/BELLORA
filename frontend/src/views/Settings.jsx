import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Building2, CalendarCheck, Eye, EyeOff, Gauge, Laptop, Monitor, Moon, Palette, ShieldCheck, Smartphone, SlidersHorizontal, Sun, UploadCloud, UserCircle, UserCog } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/stores/api'
import { notifyError, notifySuccess, notifyWarning } from '@/utils/notify'
import './Settings.css'

const settingsStorageKeys = {
  notifications: 'adminNotifications',
  preferences: 'adminPreferences',
  appearanceMode: 'adminAppearanceMode',
  darkMode: 'adminDarkMode',
  accent: 'adminAccent',
  twoFactor: 'adminTwoFactorEnabled',
  activity: 'adminActivityLogs'
}

const navGroups = [
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: UserCircle },
      { id: 'security', label: 'Security', icon: ShieldCheck },
      { id: 'account', label: 'Account', icon: UserCog }
    ]
  },
  {
    label: 'Preferences',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
      { id: 'timetable-health', label: 'Timetable Health', icon: CalendarCheck }
    ]
  }
]

const notificationOptions = [
  { key: 'email', title: 'Email notifications', description: 'Receive important account and platform messages by email.' },
  { key: 'system', title: 'System alerts', description: 'Show operational alerts inside the dashboard.' },
  { key: 'security', title: 'Security alerts', description: 'Notify when account access or sensitive settings change.' }
]

const accents = ['#0f9d8a', '#12304a', '#64748b', '#1769e0', '#e11d48']

const initialSessions = [
  { id: 1, icon: Laptop, device: 'Current browser', location: 'Local session', time: 'Now', status: 'Active' },
  { id: 2, icon: Smartphone, device: 'Mobile web', location: 'Recent login', time: 'Yesterday', status: 'Known' }
]

const initialActivityLogs = [
  { id: 1, event: 'Profile settings opened', user: 'Admin', time: 'Now', status: 'Viewed' },
  { id: 2, event: 'Settings preferences updated', user: 'System', time: 'Today', status: 'Complete' },
  { id: 3, event: 'Login session created', user: 'Admin', time: 'Recent', status: 'Success' }
]

const initialPreferences = {
  language: 'en',
  timeFormat: '24h',
  defaultView: 'Overview',
  uiDensity: 'comfortable'
}

const initialNotifications = {
  email: true,
  system: true,
  security: true
}

const initialProfile = {
  full_name: '',
  email: '',
  phone: '',
  profile_photo: ''
}

const initialSecurity = {
  password: '',
  confirmPassword: '',
  twoFactorEnabled: false
}

const initialAccount = {
  role: 'admin',
  status: 'Active'
}

const normalizeTime = (time) => String(time || '').slice(0, 5)

const resolveAssetUrl = (path) => {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path
  const apiRoot = (api.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiRoot}${path.startsWith('/') ? path : `/${path}`}`
}

const notify = (message, type = 'success') => {
  if (type === 'danger' || type === 'error') {
    notifyError(message)
    return
  }
  if (type === 'warning') {
    notifyWarning(message)
    return
  }
  notifySuccess(message)
}

export default function Settings() {
  const navigate = useNavigate()
  const authStore = useAuthStore()

  const [activeSection, setActiveSection] = useState('profile')
  const [navOpen, setNavOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)
  const [pendingSection, setPendingSection] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [baselineSnapshot, setBaselineSnapshot] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showSecurityPassword, setShowSecurityPassword] = useState(false)
  const [showSecurityConfirmPassword, setShowSecurityConfirmPassword] = useState(false)

  const [profile, setProfile] = useState(initialProfile)
  const [security, setSecurity] = useState(initialSecurity)
  const [account, setAccount] = useState(initialAccount)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [preferences, setPreferences] = useState(initialPreferences)
  const [appearance, setAppearance] = useState({
    mode: localStorage.getItem('adminAppearanceMode') || 'light',
    accent: '#0f9d8a'
  })
  const [activityLogs, setActivityLogs] = useState(initialActivityLogs)

  const [timetableHealthLoading, setTimetableHealthLoading] = useState(false)
  const [timetableHealthError, setTimetableHealthError] = useState('')
  const [timetableHealthData, setTimetableHealthData] = useState({
    classes: [],
    teachers: [],
    timetables: []
  })

  const sessions = initialSessions

  const suppressDirtyRef = useRef(false)
  const baselineRef = useRef('')
  const hasUnsavedRef = useRef(false)
  const pendingSectionRef = useRef('')
  const activeSectionRef = useRef('profile')
  const profileRef = useRef(profile)
  const securityRef = useRef(security)
  const notificationsRef = useRef(notifications)
  const preferencesRef = useRef(preferences)
  const appearanceRef = useRef(appearance)
  const activityLogsRef = useRef(activityLogs)

  activeSectionRef.current = activeSection
  profileRef.current = profile
  securityRef.current = security
  notificationsRef.current = notifications
  preferencesRef.current = preferences
  appearanceRef.current = appearance
  activityLogsRef.current = activityLogs
  hasUnsavedRef.current = hasUnsavedChanges
  pendingSectionRef.current = pendingSection
  baselineRef.current = baselineSnapshot

  const initials = (() => {
    const name = profile.full_name || profile.email || 'A'
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  })()

  const profilePhotoPreview = resolveAssetUrl(profile.profile_photo)

  const emailValidation = (() => {
    if (!profile.email) return { valid: false, message: 'Email is required' }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
    return { valid, message: valid ? 'Valid email' : 'Invalid email format' }
  })()

  const passwordsMatch = security.password === security.confirmPassword

  const passwordStrength = (() => {
    if (!security.password) return { label: 'Password strength appears here', tone: 'muted-hint' }
    let score = 0
    if (security.password.length >= 8) score += 1
    if (/[A-Z]/.test(security.password)) score += 1
    if (/[0-9]/.test(security.password)) score += 1
    if (/[^A-Za-z0-9]/.test(security.password)) score += 1
    if (score <= 1) return { label: 'Weak password', tone: 'invalid-hint' }
    if (score === 2) return { label: 'Medium password', tone: 'warning-hint' }
    if (score === 3) return { label: 'Strong password', tone: 'valid-hint' }
    return { label: 'Very strong password', tone: 'valid-hint' }
  })()

  const settingsSnapshot = JSON.stringify({
    profile: { ...profile },
    security: { twoFactorEnabled: security.twoFactorEnabled, password: security.password, confirmPassword: security.confirmPassword },
    notifications: { ...notifications },
    preferences: { ...preferences },
    appearance: { ...appearance }
  })

  const timetableLessonEntries = timetableHealthData.timetables.filter((entry) => {
    return entry.entry_type !== 'break' && entry.module_name !== 'continue'
  })

  const timetableHealthStats = (() => {
    const conflictKeys = new Map()
    timetableLessonEntries.forEach((entry) => {
      if (!entry.teacher_id || !entry.day_of_week || !entry.start_time) return
      const key = [entry.teacher_id, entry.day_of_week, normalizeTime(entry.start_time)].join('|')
      const existing = conflictKeys.get(key) || new Set()
      existing.add(entry.class_id || entry.class_name || 'unknown')
      conflictKeys.set(key, existing)
    })

    const classIdsWithTimetable = new Set(
      timetableLessonEntries.map((entry) => entry.class_id || entry.class_name).filter(Boolean)
    )
    const classCount = Math.max(classIdsWithTimetable.size, timetableHealthData.classes.length)
    const expectedSlotsPerClass = 50
    const emptySlots = Math.max((classCount * expectedSlotsPerClass) - timetableLessonEntries.length, 0)

    return {
      conflicts: Array.from(conflictKeys.values()).filter((classSet) => classSet.size > 1).length,
      emptySlots,
      unassignedTeachers: timetableHealthData.teachers.filter((teacher) => !String(teacher.assigned_modules || '').trim()).length,
      pendingTeachers: timetableHealthData.teachers.filter((teacher) => teacher.status === 'pending').length,
      classCount
    }
  })()

  const timetableHealthAlerts = (() => {
    const alerts = []
    if (timetableHealthStats.conflicts > 0) {
      alerts.push({
        label: 'Teacher conflict',
        text: `${timetableHealthStats.conflicts} time slot${timetableHealthStats.conflicts === 1 ? '' : 's'} need review.`,
        tone: 'danger'
      })
    }
    if (timetableHealthStats.emptySlots > 0) {
      alerts.push({
        label: 'Planning gap',
        text: `${timetableHealthStats.emptySlots} expected weekly slot${timetableHealthStats.emptySlots === 1 ? '' : 's'} are empty.`,
        tone: 'warning'
      })
    }
    if (timetableHealthStats.unassignedTeachers > 0) {
      alerts.push({
        label: 'Teacher load',
        text: `${timetableHealthStats.unassignedTeachers} teacher${timetableHealthStats.unassignedTeachers === 1 ? '' : 's'} have no assigned module.`,
        tone: 'warning'
      })
    }
    if (timetableHealthStats.pendingTeachers > 0) {
      alerts.push({
        label: 'Approval',
        text: `${timetableHealthStats.pendingTeachers} teacher${timetableHealthStats.pendingTeachers === 1 ? '' : 's'} awaiting DOS approval.`,
        tone: 'info'
      })
    }

    return alerts.length ? alerts : [{
      label: 'Healthy timetable',
      text: 'No urgent timetable issues detected.',
      tone: 'success'
    }]
  })()

  const addActivity = (event, status = 'Complete', user = profileRef.current.full_name || initialAccount.role || 'Admin') => {
    const nextLogs = [
      {
        id: Date.now(),
        event,
        user,
        time: new Date().toLocaleString(),
        status
      },
      ...activityLogsRef.current
    ].slice(0, 20)
    activityLogsRef.current = nextLogs
    setActivityLogs(nextLogs)
    localStorage.setItem(settingsStorageKeys.activity, JSON.stringify(nextLogs))
  }

  const applyAppearance = () => {
    const current = appearanceRef.current
    const isDark = current.mode === 'dark'
    document.body.classList.toggle('admin-dark-mode', isDark)
    localStorage.setItem(settingsStorageKeys.appearanceMode, current.mode)
    localStorage.setItem(settingsStorageKeys.darkMode, JSON.stringify(isDark))
    localStorage.setItem(settingsStorageKeys.accent, current.accent)
    document.documentElement.style.setProperty('--admin-accent', current.accent)
    document.documentElement.style.setProperty('--app-accent', current.accent)
  }

  const setThemeMode = (mode) => {
    const next = { ...appearanceRef.current, mode }
    appearanceRef.current = next
    setAppearance(next)
    applyAppearance()
    addActivity(`${mode === 'dark' ? 'Dark' : 'Light'} theme applied`)
    notify(`${mode === 'dark' ? 'Dark' : 'Light'} mode applied.`)
  }

  const setAccent = (accent) => {
    const next = { ...appearanceRef.current, accent }
    appearanceRef.current = next
    setAppearance(next)
    applyAppearance()
    addActivity(`Theme accent changed to ${accent}`)
    notify('Theme accent applied.')
  }

  const captureBaseline = (snapshot) => {
    baselineRef.current = snapshot
    setBaselineSnapshot(snapshot)
    hasUnsavedRef.current = false
    setHasUnsavedChanges(false)
  }

  const selectSection = (id) => {
    if (hasUnsavedRef.current) {
      pendingSectionRef.current = id
      setPendingSection(id)
      setUnsavedModalOpen(true)
      return
    }
    activeSectionRef.current = id
    setActiveSection(id)
    setNavOpen(false)
  }

  const loadProfile = async () => {
    await authStore.checkAuth()
    const user = authStore.currentUser || {}
    const nextProfile = {
      ...profileRef.current,
      full_name: user.full_name || user.username || user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      profile_photo: user.profile_photo || ''
    }
    profileRef.current = nextProfile
    setProfile(nextProfile)
    setAccount({
      role: user.role || authStore.currentUserType || 'admin',
      status: user.is_verified === false ? 'Unverified' : 'Active'
    })
    addActivity('Profile refreshed', 'Viewed')
    captureBaseline(JSON.stringify({
      profile: { ...nextProfile },
      security: { twoFactorEnabled: securityRef.current.twoFactorEnabled, password: securityRef.current.password, confirmPassword: securityRef.current.confirmPassword },
      notifications: { ...notificationsRef.current },
      preferences: { ...preferencesRef.current },
      appearance: { ...appearanceRef.current }
    }))
  }

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setAvatarUploading(true)
    try {
      const payload = new FormData()
      payload.append('photo', file)
      const response = await api.post('/upload/profile-photo', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const next = { ...profileRef.current, profile_photo: response.data.photo?.path || '' }
      profileRef.current = next
      setProfile(next)
      notify('Avatar uploaded. Save profile to apply it.')
      addActivity('Avatar uploaded', 'Pending save')
    } catch (error) {
      notify(error.response?.data?.message || 'Avatar upload failed.', 'danger')
      addActivity('Avatar upload failed', 'Failed')
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  const removeAvatar = () => {
    const next = { ...profileRef.current, profile_photo: '' }
    profileRef.current = next
    setProfile(next)
    notify('Avatar removed. Save changes to apply.')
  }

  const saveProfile = async () => {
    if (!emailValidation.valid) {
      notify(emailValidation.message, 'danger')
      return
    }
    const result = await authStore.updateProfile({
      username: profile.full_name.trim(),
      full_name: profile.full_name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
      profile_photo: profile.profile_photo
    })
    if (!result.success) {
      notify(result.error || 'Profile update failed.', 'danger')
      return
    }
    await authStore.checkAuth()
    const nextProfile = {
      ...profileRef.current,
      profile_photo: authStore.currentUser?.profile_photo || profileRef.current.profile_photo
    }
    profileRef.current = nextProfile
    setProfile(nextProfile)
    addActivity('Profile settings saved', 'Success')
    notify('Profile settings saved.')
    captureBaseline(JSON.stringify({
      profile: { ...nextProfile },
      security: { twoFactorEnabled: securityRef.current.twoFactorEnabled, password: securityRef.current.password, confirmPassword: securityRef.current.confirmPassword },
      notifications: { ...notificationsRef.current },
      preferences: { ...preferencesRef.current },
      appearance: { ...appearanceRef.current }
    }))
  }

  const saveSecurity = async () => {
    if (!security.password && !security.confirmPassword) {
      notify('Security preferences saved.')
      return
    }
    if (security.password.length < 6) {
      notify('Password must be at least 6 characters.', 'danger')
      return
    }
    if (security.password !== security.confirmPassword) {
      notify('Passwords do not match.', 'danger')
      return
    }
    const result = await authStore.updateProfile({
      username: profileRef.current.full_name,
      email: profileRef.current.email,
      phone: profileRef.current.phone,
      password: security.password,
      profile_photo: profileRef.current.profile_photo
    })
    if (!result.success) {
      notify(result.error || 'Password update failed.', 'danger')
      return
    }
    const nextSecurity = { ...securityRef.current, password: '', confirmPassword: '' }
    securityRef.current = nextSecurity
    setSecurity(nextSecurity)
    localStorage.setItem(settingsStorageKeys.twoFactor, JSON.stringify(nextSecurity.twoFactorEnabled))
    addActivity('Security settings saved', 'Success')
    notify('Security settings saved.')
    captureBaseline(JSON.stringify({
      profile: { ...profileRef.current },
      security: { twoFactorEnabled: nextSecurity.twoFactorEnabled, password: nextSecurity.password, confirmPassword: nextSecurity.confirmPassword },
      notifications: { ...notificationsRef.current },
      preferences: { ...preferencesRef.current },
      appearance: { ...appearanceRef.current }
    }))
  }

  const saveLocalPreferences = () => {
    localStorage.setItem(settingsStorageKeys.notifications, JSON.stringify(notificationsRef.current))
    localStorage.setItem(settingsStorageKeys.preferences, JSON.stringify(preferencesRef.current))
    localStorage.setItem(settingsStorageKeys.twoFactor, JSON.stringify(securityRef.current.twoFactorEnabled))
    applyAppearance()
    addActivity(`${activeSectionRef.current} settings saved`, 'Success')
    notify('Settings saved.')
    captureBaseline(JSON.stringify({
      profile: { ...profileRef.current },
      security: { twoFactorEnabled: securityRef.current.twoFactorEnabled, password: securityRef.current.password, confirmPassword: securityRef.current.confirmPassword },
      notifications: { ...notificationsRef.current },
      preferences: { ...preferencesRef.current },
      appearance: { ...appearanceRef.current }
    }))
  }

  const saveActiveSection = async () => {
    setSavingSettings(true)
    try {
      if (activeSectionRef.current === 'profile') await saveProfile()
      else if (activeSectionRef.current === 'security') await saveSecurity()
      else saveLocalPreferences()
      notify('Settings updated successfully.')
    } finally {
      setSavingSettings(false)
    }
  }

  const saveAndContinue = async () => {
    await saveActiveSection()
    if (pendingSectionRef.current) {
      activeSectionRef.current = pendingSectionRef.current
      setActiveSection(pendingSectionRef.current)
      pendingSectionRef.current = ''
      setPendingSection('')
    }
    setUnsavedModalOpen(false)
  }

  const discardChanges = () => {
    suppressDirtyRef.current = true
    const snapshot = baselineRef.current ? JSON.parse(baselineRef.current) : null
    if (snapshot) {
      const nextProfile = { ...profileRef.current, ...snapshot.profile }
      const nextSecurity = { ...securityRef.current, ...snapshot.security }
      const nextNotifications = { ...notificationsRef.current, ...snapshot.notifications }
      const nextPreferences = { ...preferencesRef.current, ...snapshot.preferences }
      const nextAppearance = { ...appearanceRef.current, ...snapshot.appearance }
      profileRef.current = nextProfile
      securityRef.current = nextSecurity
      notificationsRef.current = nextNotifications
      preferencesRef.current = nextPreferences
      appearanceRef.current = nextAppearance
      setProfile(nextProfile)
      setSecurity(nextSecurity)
      setNotifications(nextNotifications)
      setPreferences(nextPreferences)
      setAppearance(nextAppearance)
    }
    hasUnsavedRef.current = false
    setHasUnsavedChanges(false)
    setTimeout(() => { suppressDirtyRef.current = false }, 0)
  }

  const discardAndContinue = () => {
    discardChanges()
    if (pendingSectionRef.current) {
      activeSectionRef.current = pendingSectionRef.current
      setActiveSection(pendingSectionRef.current)
      pendingSectionRef.current = ''
      setPendingSection('')
    }
    setUnsavedModalOpen(false)
  }

  const logout = () => {
    authStore.logout()
    navigate('/login')
  }

  const goToDefaultDashboard = () => {
    const paths = {
      Overview: '/super-admin/dashboard',
      Schools: '/super-admin/schools',
      DOS: '/super-admin/dos',
      Reports: '/super-admin/reports'
    }
    navigate(paths[preferences.defaultView] || '/super-admin/dashboard')
  }

  const loadTimetableHealthData = async () => {
    setTimetableHealthLoading(true)
    setTimetableHealthError('')
    try {
      const [classesResponse, teachersResponse, timetableResponse] = await Promise.allSettled([
        api.get('/classes'),
        api.get('/teachers'),
        api.get('/timetable')
      ])

      setTimetableHealthData({
        classes: classesResponse.status === 'fulfilled' ? classesResponse.value.data.classes || [] : [],
        teachers: teachersResponse.status === 'fulfilled' ? teachersResponse.value.data.teachers || [] : [],
        timetables: timetableResponse.status === 'fulfilled' ? timetableResponse.value.data.timetables || [] : []
      })

      const failed = [classesResponse, teachersResponse, timetableResponse].find((result) => result.status === 'rejected')
      if (failed) {
        setTimetableHealthError(failed.reason?.response?.data?.message
          || failed.reason?.response?.data?.error
          || 'Some timetable health data could not load.')
      }
    } finally {
      setTimetableHealthLoading(false)
    }
  }

  const handleBeforeUnload = (event) => {
    if (!hasUnsavedRef.current) return
    event.preventDefault()
    event.returnValue = ''
  }

  useEffect(() => {
    const savedNotifications = JSON.parse(localStorage.getItem(settingsStorageKeys.notifications) || '{}')
    const mergedNotifications = { ...notificationsRef.current, ...savedNotifications }
    notificationsRef.current = mergedNotifications
    setNotifications(mergedNotifications)
    const savedPreferences = JSON.parse(localStorage.getItem(settingsStorageKeys.preferences) || '{}')
    const mergedPreferences = { ...preferencesRef.current, ...savedPreferences }
    preferencesRef.current = mergedPreferences
    setPreferences(mergedPreferences)
    const savedDarkMode = JSON.parse(localStorage.getItem(settingsStorageKeys.darkMode) || 'false')
    const nextAppearance = {
      ...appearanceRef.current,
      mode: localStorage.getItem(settingsStorageKeys.appearanceMode) || (savedDarkMode ? 'dark' : appearanceRef.current.mode),
      accent: localStorage.getItem(settingsStorageKeys.accent) || appearanceRef.current.accent
    }
    appearanceRef.current = nextAppearance
    setAppearance(nextAppearance)
    const nextSecurity = {
      ...securityRef.current,
      twoFactorEnabled: JSON.parse(localStorage.getItem(settingsStorageKeys.twoFactor) || 'false')
    }
    securityRef.current = nextSecurity
    setSecurity(nextSecurity)
    try {
      const savedLogs = JSON.parse(localStorage.getItem(settingsStorageKeys.activity) || '[]')
      if (Array.isArray(savedLogs) && savedLogs.length) {
        activityLogsRef.current = savedLogs
        setActivityLogs(savedLogs)
      }
    } catch (error) {
      localStorage.removeItem(settingsStorageKeys.activity)
    }
    applyAppearance()
    window.addEventListener('beforeunload', handleBeforeUnload)
    loadProfile()
    loadTimetableHealthData()

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    applyAppearance()
  }, [appearance.mode, appearance.accent])

  useEffect(() => {
    if (suppressDirtyRef.current || !baselineRef.current) return
    const dirty = settingsSnapshot !== baselineRef.current
    hasUnsavedRef.current = dirty
    setHasUnsavedChanges(dirty)
  }, [settingsSnapshot])

  const updateNotification = (key, value) => {
    const next = { ...notificationsRef.current, [key]: value }
    notificationsRef.current = next
    setNotifications(next)
  }

  const updatePreference = (key, value) => {
    const next = { ...preferencesRef.current, [key]: value }
    preferencesRef.current = next
    setPreferences(next)
  }

  const updateProfileField = (key, value) => {
    const next = { ...profileRef.current, [key]: value }
    profileRef.current = next
    setProfile(next)
  }

  const updateSecurityField = (key, value) => {
    const next = { ...securityRef.current, [key]: value }
    securityRef.current = next
    setSecurity(next)
  }

  return (
    <AppLayout>
      <div className={`settings-control${preferences.uiDensity === 'compact' ? ' is-compact' : ''}`}>
        <header className="settings-hero">
          <div>
            <h1>Settings</h1>
            <p>Manage your account and platform preferences.</p>
          </div>
        </header>

        <section className="settings-shell">
          <aside className={`settings-nav${navOpen ? ' open' : ''}`}>
            <button className="mobile-nav-toggle" type="button" aria-expanded={navOpen} aria-controls="settings-navigation-list" onClick={() => setNavOpen(!navOpen)}>
              <SlidersHorizontal size={16} strokeWidth={2.2} aria-hidden="true" />
              Settings Menu
            </button>
            <div className="nav-list" id="settings-navigation-list">
              {navGroups.map((group) => (
                <div key={group.label} className="nav-group">
                  <strong>{group.label}</strong>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav-item${activeSection === item.id ? ' active' : ''}`}
                        aria-label={item.label}
                        title={item.label}
                        onClick={() => selectSection(item.id)}
                      >
                        <Icon className="settings-svg" size={18} strokeWidth={2.2} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </aside>

          <main className="settings-content">
            <div key={activeSection} className="settings-section-transition">
              {activeSection === 'profile' && (
                <section className="section-grid">
                  <div className="settings-card profile-card">
                    <div className="card-heading">
                      <span className="heading-icon"><UserCircle size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Profile Settings</span>
                        <h2>Personal Details</h2>
                      </div>
                    </div>
                    <div className="profile-row">
                      <div className="avatar-preview">
                        {profilePhotoPreview ? (
                          <img src={profilePhotoPreview} alt="Profile avatar" />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <div className="avatar-actions">
                        <label className="upload-btn">
                          <UploadCloud size={16} strokeWidth={2.2} aria-hidden="true" />
                          {avatarUploading ? 'Uploading...' : 'Upload'}
                          <input type="file" accept="image/*" disabled={avatarUploading} onChange={handleAvatarUpload} />
                        </label>
                        <button className="tool-btn secondary" type="button" onClick={removeAvatar}>Remove</button>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <label className="field">
                        <span>Full Name</span>
                        <input value={profile.full_name} onChange={(event) => updateProfileField('full_name', event.target.value)} type="text" />
                      </label>
                      <label className="field">
                        <span>Email</span>
                        <input value={profile.email} onChange={(event) => updateProfileField('email', event.target.value)} type="email" />
                        <em className={emailValidation.valid ? 'valid-hint' : 'invalid-hint'}>{emailValidation.message}</em>
                      </label>
                      <label className="field">
                        <span>Phone Number</span>
                        <input value={profile.phone} onChange={(event) => updateProfileField('phone', event.target.value)} type="tel" />
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'security' && (
                <section className="section-grid">
                  <div className="settings-card">
                    <div className="card-heading">
                      <span className="heading-icon"><ShieldCheck size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Security Settings</span>
                        <h2>Password & Access</h2>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <label className="field">
                        <span>New Password</span>
                        <div className="password-wrap">
                          <input value={security.password} onChange={(event) => updateSecurityField('password', event.target.value)} type={showSecurityPassword ? 'text' : 'password'} placeholder="Minimum 6 characters" />
                          <button type="button" aria-label={showSecurityPassword ? 'Hide password' : 'Show password'} onClick={() => setShowSecurityPassword(!showSecurityPassword)}>
                            {showSecurityPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                          </button>
                        </div>
                        <em className={passwordStrength.tone}>{passwordStrength.label}</em>
                      </label>
                      <label className="field">
                        <span>Confirm Password</span>
                        <div className="password-wrap">
                          <input value={security.confirmPassword} onChange={(event) => updateSecurityField('confirmPassword', event.target.value)} type={showSecurityConfirmPassword ? 'text' : 'password'} />
                          <button type="button" aria-label={showSecurityConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowSecurityConfirmPassword(!showSecurityConfirmPassword)}>
                            {showSecurityConfirmPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                          </button>
                        </div>
                        {security.confirmPassword && (
                          <em className={passwordsMatch ? 'valid-hint' : 'invalid-hint'}>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</em>
                        )}
                      </label>
                    </div>
                    <div className="security-actions">
                      <label className="toggle-row">
                        <input checked={security.twoFactorEnabled} onChange={(event) => updateSecurityField('twoFactorEnabled', event.target.checked)} type="checkbox" />
                        <span></span>
                        <div>
                          <strong>Two-factor authentication</strong>
                          <small>Save this preference for the current admin account.</small>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="settings-card">
                    <div className="card-heading">
                      <span className="heading-icon"><Monitor size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Login Sessions</span>
                        <h2>Recent Sessions</h2>
                      </div>
                    </div>
                    <div className="session-list">
                      {sessions.map((session) => {
                        const Icon = session.icon
                        return (
                          <div key={session.id} className="session-item">
                            <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
                            <div>
                              <strong>{session.device}</strong>
                              <span>{session.location} · {session.time}</span>
                            </div>
                            <em>{session.status}</em>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'account' && (
                <section className="section-grid">
                  <div className="settings-card">
                    <div className="card-heading">
                      <span className="heading-icon"><UserCog size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Account Settings</span>
                        <h2>Role & Workspace</h2>
                      </div>
                    </div>
                    <div className="account-summary">
                      <div><span>Role</span><strong>{account.role}</strong></div>
                      <div><span>Status</span><strong>{account.status}</strong></div>
                      <div><span>Default Dashboard</span><strong>{preferences.defaultView}</strong></div>
                    </div>
                    <div className="quick-tools">
                      <button className="tool-btn secondary" type="button" onClick={goToDefaultDashboard}>
                        <Gauge size={16} strokeWidth={2.2} aria-hidden="true" />
                        Open Default Dashboard
                      </button>
                      <button className="tool-btn secondary" type="button" onClick={() => navigate('/super-admin/schools')}>
                        <Building2 size={16} strokeWidth={2.2} aria-hidden="true" />
                        Manage Schools
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'notifications' && (
                <section className="section-grid">
                  <div className="settings-card">
                    <div className="card-heading">
                      <span className="heading-icon"><Bell size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Notification Settings</span>
                        <h2>Alert Channels</h2>
                      </div>
                    </div>
                    <div className="toggle-list">
                      {notificationOptions.map((item) => (
                        <label key={item.key} className="switch-card">
                          <input checked={notifications[item.key]} onChange={(event) => updateNotification(item.key, event.target.checked)} type="checkbox" />
                          <span></span>
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'preferences' && (
                <section className="section-grid">
                  <div className="settings-card">
                    <div className="card-heading">
                      <span className="heading-icon"><SlidersHorizontal size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">System Preferences</span>
                        <h2>Default Behavior</h2>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <label className="field">
                        <span>Language</span>
                        <select value={preferences.language} onChange={(event) => updatePreference('language', event.target.value)}>
                          <option value="en">English</option>
                          <option value="fr">French</option>
                          <option value="pt">Portuguese</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Time Format</span>
                        <select value={preferences.timeFormat} onChange={(event) => updatePreference('timeFormat', event.target.value)}>
                          <option value="24h">24 hour</option>
                          <option value="12h">12 hour</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Default Dashboard View</span>
                        <select value={preferences.defaultView} onChange={(event) => updatePreference('defaultView', event.target.value)}>
                          <option value="Overview">Overview</option>
                          <option value="Schools">Schools</option>
                          <option value="DOS">DOS</option>
                          <option value="Reports">Reports</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'timetable-health' && (
                <section className="section-grid">
                  <div className="settings-card timetable-health-card">
                    <div className="card-heading split-heading">
                      <span className="heading-icon"><CalendarCheck size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Timetable Health</span>
                        <h2>Planning Checks</h2>
                      </div>
                      <button className="tool-btn secondary" type="button" disabled={timetableHealthLoading} onClick={loadTimetableHealthData}>
                        {timetableHealthLoading ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button className="tool-btn primary" type="button" onClick={() => navigate('/timetable')}>Fix Timetable</button>
                    </div>

                    {timetableHealthError && <div className="health-error">{timetableHealthError}</div>}

                    <div className="settings-health-grid">
                      <article className={timetableHealthStats.conflicts > 0 ? 'warning' : undefined}>
                        <span>Conflicts</span>
                        <strong>{timetableHealthStats.conflicts}</strong>
                        <small>{timetableHealthStats.conflicts ? 'same teacher, same time' : 'no teacher clash found'}</small>
                      </article>
                      <article className={timetableHealthStats.emptySlots > 0 ? 'warning' : undefined}>
                        <span>Empty Slots</span>
                        <strong>{timetableHealthStats.emptySlots}</strong>
                        <small>{timetableHealthStats.classCount} classes checked</small>
                      </article>
                      <article className={timetableHealthStats.unassignedTeachers > 0 ? 'warning' : undefined}>
                        <span>No Modules</span>
                        <strong>{timetableHealthStats.unassignedTeachers}</strong>
                        <small>teachers without assigned modules</small>
                      </article>
                      <article className={timetableHealthStats.pendingTeachers > 0 ? 'warning' : undefined}>
                        <span>Pending</span>
                        <strong>{timetableHealthStats.pendingTeachers}</strong>
                        <small>teachers awaiting approval</small>
                      </article>
                    </div>

                    <div className="settings-health-alerts">
                      {timetableHealthAlerts.map((alert) => (
                        <div key={alert.label} className={`settings-health-alert ${alert.tone}`}>
                          <strong>{alert.label}</strong>
                          <span>{alert.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'appearance' && (
                <section className="section-grid">
                  <div className="settings-card">
                    <div className="card-heading">
                      <span className="heading-icon"><Palette size={19} strokeWidth={2.2} aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">Appearance Settings</span>
                        <h2>Theme & Density</h2>
                      </div>
                    </div>
                    <div className="appearance-grid">
                      <button type="button" className={`theme-card${appearance.mode === 'light' ? ' active' : ''}`} onClick={() => setThemeMode('light')}>
                        <Sun size={17} strokeWidth={2.2} aria-hidden="true" />
                        Light Mode
                      </button>
                      <button type="button" className={`theme-card${appearance.mode === 'dark' ? ' active' : ''}`} onClick={() => setThemeMode('dark')}>
                        <Moon size={17} strokeWidth={2.2} aria-hidden="true" />
                        Dark Mode
                      </button>
                    </div>
                    <div className="accent-row">
                      <span>Theme accent preview</span>
                      {accents.map((accent) => (
                        <button
                          key={accent}
                          type="button"
                          className={`accent-dot${appearance.accent === accent ? ' active' : ''}`}
                          style={{ background: accent }}
                          title={`Use ${accent}`}
                          onClick={() => setAccent(accent)}
                        ></button>
                      ))}
                    </div>
                    <label className="field">
                      <span>UI Density</span>
                      <select value={preferences.uiDensity} onChange={(event) => updatePreference('uiDensity', event.target.value)}>
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                      </select>
                    </label>
                  </div>
                </section>
              )}
            </div>
          </main>
        </section>

        {hasUnsavedChanges && (
          <div className="sticky-save-bar">
            <strong>{savingSettings ? 'Saving settings...' : 'You have unsaved changes'}</strong>
            <div>
              <button className="tool-btn secondary" type="button" disabled={savingSettings} onClick={discardChanges}>Discard Changes</button>
              <button className="tool-btn primary inline-loading" type="button" disabled={savingSettings} onClick={saveActiveSection}>
                {savingSettings && <i aria-hidden="true"></i>}
                {savingSettings ? 'Saving settings...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {unsavedModalOpen && createPortal(
          <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setUnsavedModalOpen(false) }}>
            <section className="confirm-modal">
              <AlertTriangle size={30} strokeWidth={2.1} aria-hidden="true" />
              <h2>You have unsaved changes</h2>
              <p>Do you want to save before leaving this section?</p>
              <div className="modal-actions">
                <button className="tool-btn primary" type="button" disabled={savingSettings} onClick={saveAndContinue}>{savingSettings ? 'Saving settings...' : 'Save'}</button>
                <button className="tool-btn secondary" type="button" disabled={savingSettings} onClick={discardAndContinue}>Discard</button>
                <button className="tool-btn ghost" type="button" disabled={savingSettings} onClick={() => setUnsavedModalOpen(false)}>Cancel</button>
              </div>
            </section>
          </div>,
          document.body
        )}

        {showLogoutModal && createPortal(
          <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowLogoutModal(false) }}>
            <section className="confirm-modal">
              <AlertTriangle size={30} strokeWidth={2.1} aria-hidden="true" />
              <h2>Confirm logout</h2>
              <p>You will be returned to the unified login page.</p>
              <div className="modal-actions">
                <button className="tool-btn secondary" type="button" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                <button className="tool-btn danger" type="button" onClick={logout}>Logout</button>
              </div>
            </section>
          </div>,
          document.body
        )}
      </div>
    </AppLayout>
  )
}
