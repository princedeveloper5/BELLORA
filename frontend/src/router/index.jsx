import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { authActions, authStore } from '@/stores/authStore'
import { loadingActions } from '@/stores/loadingStore'
import { routeMeta } from '@/router/meta'

const Login = lazy(() => import('@/views/Login'))
const RoleSelect = lazy(() => import('@/views/RoleSelect'))
const Register = lazy(() => import('@/views/Register'))
const DosRegister = lazy(() => import('@/views/DosRegister'))
const ForgotPassword = lazy(() => import('@/views/ForgotPassword'))
const ResetPassword = lazy(() => import('@/views/ResetPassword'))
const AccountStatus = lazy(() => import('@/views/AccountStatus'))

const SaDashboard = lazy(() => import('@/sa/views/SaDashboard'))
const SaSchools = lazy(() => import('@/sa/views/SaSchools'))
const SaSchoolDetail = lazy(() => import('@/sa/views/SaSchoolDetail'))
const SaApprovals = lazy(() => import('@/sa/views/SaApprovals'))
const SaUsers = lazy(() => import('@/sa/views/SaUsers'))
const SaReports = lazy(() => import('@/sa/views/SaReports'))
const SaNotifications = lazy(() => import('@/sa/views/SaNotifications'))
const SaActivity = lazy(() => import('@/sa/views/SaActivity'))
const SaSettings = lazy(() => import('@/sa/views/SaSettings'))
const SaProfile = lazy(() => import('@/sa/views/SaProfile'))

const DosDashboard = lazy(() => import('@/dos/DosDashboard'))
const DosTimetables = lazy(() => import('@/dos/DosTimetables'))
const DosConflicts = lazy(() => import('@/dos/DosConflicts'))
const DosTimetableView = lazy(() => import('@/dos/DosTimetableView'))
const DosTeachers = lazy(() => import('@/dos/DosTeachers'))
const DosClasses = lazy(() => import('@/dos/DosClasses'))
const DosSubjects = lazy(() => import('@/dos/DosSubjects'))
const DosRooms = lazy(() => import('@/dos/DosRooms'))
const DosReports = lazy(() => import('@/dos/DosReports'))
const DosActivity = lazy(() => import('@/dos/DosActivity'))
const DosSettings = lazy(() => import('@/dos/DosSettings'))

const Teachers = lazy(() => import('@/views/Teachers'))
const Modules = lazy(() => import('@/views/Modules'))
const Classes = lazy(() => import('@/views/Classes'))
const Students = lazy(() => import('@/views/Students'))
const Sections = lazy(() => import('@/views/Sections'))
const Shifts = lazy(() => import('@/views/Shifts'))
const Rooms = lazy(() => import('@/views/Rooms'))
const Assignments = lazy(() => import('@/views/Assignments'))
const Settings = lazy(() => import('@/views/Settings'))
const Notifications = lazy(() => import('@/views/Notifications'))
const Announcements = lazy(() => import('@/views/Announcements'))
const TeacherPortal = lazy(() => import('@/views/TeacherPortal'))
const TeacherSettings = lazy(() => import('@/views/TeacherSettings'))
const TeacherTimetable = lazy(() => import('@/views/TeacherTimetable'))
const TeacherNotifications = lazy(() => import('@/views/TeacherNotifications'))
const TeacherCurrentCounter = lazy(() => import('@/views/TeacherCurrentCounter'))
const TeacherProfile = lazy(() => import('@/views/TeacherProfile'))

const TcDashboard = lazy(() => import('@/tc/TcDashboard'))
const TcAttendance = lazy(() => import('@/tc/TcAttendance'))
const TcResults = lazy(() => import('@/tc/TcResults'))

const StDashboard = lazy(() => import('@/st/StDashboard'))
const StTimetable = lazy(() => import('@/st/StTimetable'))
const StSubjects = lazy(() => import('@/st/StSubjects'))
const StAttendance = lazy(() => import('@/st/StAttendance'))
const StResults = lazy(() => import('@/st/StResults'))
const StProfile = lazy(() => import('@/st/StProfile'))

export const roleHome = (userType) => {
  if (userType === 'super_admin') return '/super-admin/dashboard'
  if (userType === 'dos' || userType === 'admin') return '/dos/dashboard'
  if (userType === 'teacher') return '/teacher/dashboard'
  if (userType === 'student') return '/student/dashboard'
  return '/login'
}

const ADMIN_ROLES = ['dos', 'admin', 'super_admin']

function RouteGuard({ children, mode, roles }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState('checking')
  const rolesKey = roles ? roles.join(',') : ''

  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('token')
    const userType = localStorage.getItem('userType')

    if (mode === 'guest') {
      if (!token) {
        setState('allow')
        return undefined
      }
      const home = roleHome(userType)
      navigate(home, { replace: true })
      return undefined
    }

    if (!token) {
      navigate('/login', { replace: true })
      return undefined
    }

    authActions.checkAuth(api).then((isValid) => {
      if (cancelled) return

      if (!isValid) {
        navigate('/login', { replace: true })
        return
      }

      const currentType = authStore.getState().userType

      if (rolesKey && !rolesKey.split(',').includes(currentType)) {
        navigate(roleHome(currentType), { replace: true })
        return
      }

      setState('allow')
    })

    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search, mode, navigate, rolesKey])

  if (state !== 'allow') return null
  return children
}

function RouteLoading() {
  const location = useLocation()

  useEffect(() => {
    loadingActions.startRoute()
    const { title } = routeMeta(location.pathname)
    document.title = `${title} · PANTA`
    const timer = setTimeout(() => loadingActions.finishRoute(), 60)
    return () => clearTimeout(timer)
  }, [location.pathname, location.search])

  return null
}

function NotFound() {
  return <Navigate to="/login" replace />
}

export default function AppRouter() {
  return (
    <HashRouter>
      <RouteLoading />
      <Suspense fallback={<div className="panta-route-loading">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <RouteGuard mode="guest">
                <Login />
              </RouteGuard>
            }
          />
          <Route
            path="/choose-role"
            element={
              <RouteGuard mode="guest">
                <RoleSelect />
              </RouteGuard>
            }
          />
          <Route
            path="/register"
            element={
              <RouteGuard mode="guest">
                <Register />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/register"
            element={
              <RouteGuard mode="guest">
                <DosRegister />
              </RouteGuard>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <RouteGuard mode="guest">
                <ForgotPassword />
              </RouteGuard>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/account-status" element={<AccountStatus />} />
          <Route path="/dashboard" element={<Navigate to="/dos/dashboard" replace />} />

          {/* ---------------- Super Admin platform ---------------- */}
          <Route
            path="/super-admin/dashboard"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaDashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/schools"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaSchools />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/schools/:id"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaSchoolDetail />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/approvals"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaApprovals />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/users"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaUsers />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/users/:role"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaUsers />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/reports"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaReports />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/notifications"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaNotifications />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/activity"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaActivity />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/settings"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaSettings />
              </RouteGuard>
            }
          />
          <Route
            path="/super-admin/profile"
            element={
              <RouteGuard roles={['super_admin']}>
                <SaProfile />
              </RouteGuard>
            }
          />
          <Route path="/super-admin/academic-years" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/terms" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/classes" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/subjects" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/departments" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/timetables/*" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/analytics" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/super-admin/dos" element={<Navigate to="/super-admin/users/dos" replace />} />
          <Route path="/super-admin/databases" element={<Navigate to="/super-admin/settings" replace />} />
          <Route path="/super-admin/billing" element={<Navigate to="/super-admin/reports?type=subscription" replace />} />
          <Route path="/super-admin/administration" element={<Navigate to="/super-admin/settings" replace />} />

          {/* ---------------- Director of Studies console ---------------- */}
          <Route
            path="/dos/dashboard"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosDashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/timetables"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosTimetables />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/timetables/conflicts"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosConflicts />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/timetables/:id"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosTimetableView />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/teachers"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosTeachers />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/classes"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosClasses />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/subjects"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosSubjects />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/rooms"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosRooms />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/reports"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosReports />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/activity"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosActivity />
              </RouteGuard>
            }
          />
          <Route
            path="/dos/settings"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <DosSettings />
              </RouteGuard>
            }
          />

          {/* ---------------- Shared admin resources ---------------- */}
          <Route
            path="/teachers"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Teachers />
              </RouteGuard>
            }
          />
          <Route
            path="/modules"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Modules />
              </RouteGuard>
            }
          />
          <Route
            path="/classes"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Classes />
              </RouteGuard>
            }
          />
          <Route
            path="/students"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Students />
              </RouteGuard>
            }
          />
          <Route
            path="/sections"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Sections />
              </RouteGuard>
            }
          />
          <Route
            path="/shifts"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Shifts />
              </RouteGuard>
            }
          />
          <Route
            path="/rooms"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Rooms />
              </RouteGuard>
            }
          />
          <Route
            path="/assignments"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Assignments />
              </RouteGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <RouteGuard roles={['dos', 'admin']}>
                <Settings />
              </RouteGuard>
            }
          />
          <Route
            path="/notifications"
            element={
              <RouteGuard roles={ADMIN_ROLES}>
                <Notifications />
              </RouteGuard>
            }
          />
          <Route
            path="/announcements"
            element={
              <RouteGuard roles={ADMIN_ROLES}>
                <Announcements />
              </RouteGuard>
            }
          />
          <Route path="/academic-reports" element={<Navigate to="/dos/reports" replace />} />
          <Route path="/timetable" element={<Navigate to="/dos/timetables" replace />} />

          {/* ---------------- Teacher workspace ---------------- */}
          <Route
            path="/teacher/settings"
            element={
              <RouteGuard roles={['teacher']}>
                <TeacherSettings />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/dashboard"
            element={
              <RouteGuard roles={['teacher']}>
                <TcDashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/timetable"
            element={
              <RouteGuard roles={['teacher']}>
                <TeacherTimetable />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <RouteGuard roles={['teacher']}>
                <TcAttendance />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/results"
            element={
              <RouteGuard roles={['teacher']}>
                <TcResults />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/notifications"
            element={
              <RouteGuard roles={['teacher']}>
                <TeacherNotifications />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/current-counter"
            element={
              <RouteGuard roles={['teacher']}>
                <TeacherCurrentCounter />
              </RouteGuard>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <RouteGuard roles={['teacher']}>
                <TeacherProfile />
              </RouteGuard>
            }
          />
          <Route path="/teacher/register" element={<Navigate to="/register" replace />} />
          <Route path="/teacher/login" element={<Navigate to="/login" replace />} />
          <Route path="/teacher/requests" element={<Navigate to="/teacher/dashboard" replace />} />
          <Route path="/teacher/announcements" element={<Navigate to="/teacher/dashboard" replace />} />
          <Route
            path="/teacher-portal"
            element={
              <RouteGuard roles={ADMIN_ROLES}>
                <TeacherPortal />
              </RouteGuard>
            }
          />

          {/* ---------------- Student workspace ---------------- */}
          <Route
            path="/student/dashboard"
            element={
              <RouteGuard roles={['student']}>
                <StDashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <RouteGuard roles={['student']}>
                <StTimetable />
              </RouteGuard>
            }
          />
          <Route
            path="/student/subjects"
            element={
              <RouteGuard roles={['student']}>
                <StSubjects />
              </RouteGuard>
            }
          />
          <Route
            path="/student/attendance"
            element={
              <RouteGuard roles={['student']}>
                <StAttendance />
              </RouteGuard>
            }
          />
          <Route
            path="/student/results"
            element={
              <RouteGuard roles={['student']}>
                <StResults />
              </RouteGuard>
            }
          />
          <Route
            path="/student/profile"
            element={
              <RouteGuard roles={['student']}>
                <StProfile />
              </RouteGuard>
            }
          />
          <Route path="/student-portal" element={<Navigate to="/student/dashboard" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
