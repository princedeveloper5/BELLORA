import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarClock, BookOpen, ClipboardCheck, CircleUserRound, Menu, GraduationCap, School
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useStore } from '@/stores/useStore'
import { initials } from '@/sa/format'
import AppSidebar from '@/sa/components/AppSidebar'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import ToastHost from '@/sa/components/ToastHost'
import { stStore, stActions } from './stStore'
import useSidebarState from '@/hooks/useSidebarState'
import { resolveAssetUrl } from '@/utils/resolveAssetUrl'
import '@/dos/theme.css'
import '@/sa/sa.css'

const pageTitles = {
  '/student/dashboard': 'Dashboard',
  '/student/timetable': 'Timetable',
  '/student/subjects': 'Subjects',
  '/student/attendance': 'Attendance',
  '/student/results': 'Results',
  '/student/profile': 'Profile'
}

const nav = [
  {
    label: 'Main',
    items: [{ label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard }]
  },
  {
    label: 'Learning',
    items: [
      { label: 'My Timetable', to: '/student/timetable', icon: CalendarClock },
      { label: 'My Subjects', to: '/student/subjects', icon: BookOpen },
      { label: 'Academic Results', to: '/student/results', icon: GraduationCap },
      { label: 'Attendance', to: '/student/attendance', icon: ClipboardCheck }
    ]
  },
  {
    label: 'System',
    items: [{ label: 'Profile', to: '/student/profile', icon: CircleUserRound }]
  }
]

const footerItems = [
  { label: 'Profile', to: '/student/profile', icon: CircleUserRound }
]

export default function StLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const store = useStore(stStore)

  useEffect(() => {
    document.body.classList.remove('admin-dark-mode', 'teacher-dark-mode', 'dark')
  }, [])

  useEffect(() => {
    stActions.bootstrap()
  }, [])

  const [confirmLogout, setConfirmLogout] = useState(false)
  const { collapsed, drawer, toggleSidebar, closeDrawer } = useSidebarState()

  const studentName = store.overview?.student?.name || authStore.user?.name || authStore.user?.full_name || 'Student'
  const pageTitle = pageTitles[location.pathname] || 'Dashboard'

  const logout = () => {
    setConfirmLogout(false)
    authStore.logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--panta-bg)', color: 'var(--panta-text)' }}>
      {/* Sidebar */}
      <AppSidebar
        sections={nav}
        footerItems={footerItems}
        profileTo="/student/profile"
        userName={studentName}
        roleLabel="Student"
        collapsed={collapsed}
        drawer={drawer}
        onNavigate={closeDrawer}
        onLogout={() => setConfirmLogout(true)}
        logoUrl={resolveAssetUrl(store.overview?.schoolLogo) || `${import.meta.env.BASE_URL}bellora-brand-mark.png`}
        logoAlt={store.overview?.schoolLogo ? 'School logo' : 'BELLORA logo'}
        logoLabel={store.overview?.schoolName || 'BELLORA'}
        logoSubtitle="Student Portal"
      />

      {drawer ? (
        <div className="fixed inset-0 z-30 bg-[#071D33]/50 lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      ) : null}

      <div className={`flex flex-col min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[var(--panta-border)] flex items-center gap-2 sm:gap-3 px-3 sm:px-5"
          style={{ height: 'var(--panta-header-h)' }}>
          <button type="button" className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors shrink-0" aria-label="Toggle sidebar" onClick={toggleSidebar}><Menu size={19} /></button>
          <div className="min-w-0 hidden md:block">
            <h1 className="text-[15px] font-bold truncate leading-5">
              Home <span className="text-[#C6D4E3] mx-0.5">/</span> <span className="text-[#1769E0]">{pageTitle}</span>
            </h1>
            <p className="text-[11.5px] truncate flex items-center gap-1" style={{ color: 'var(--panta-muted)' }}>
              <School size={10} className="shrink-0" />{store.overview?.schoolName || 'My School'}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Link to="/student/profile" className="flex items-center gap-2.5 rounded-full pl-1 pr-2 sm:pr-3 py-1 hover:bg-[#f1f5fb] transition" aria-label="My profile">
              <span className="relative">
                <span className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--panta-teal), var(--panta-sidebar))' }}>{initials(studentName)}</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#18B981] border-2 border-white"></span>
              </span>
              <span className="hidden lg:block text-left leading-tight">
                <span className="block text-[13px] font-bold" style={{ color: 'var(--panta-text)' }}>{studentName}</span>
                <span className="block text-[10.5px] font-medium" style={{ color: 'var(--panta-muted)' }}>Student</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="grow p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
        <footer className="px-6 py-4 text-center text-[11.5px] border-t border-[var(--panta-border)]" style={{ color: 'var(--panta-muted)' }}>
          BELLORA · Student Portal · {new Date().getFullYear()}
        </footer>
      </div>

      <ConfirmDialog open={confirmLogout} title="Sign out?" danger confirmLabel="Sign out"
        message="You will be signed out and will need your credentials to sign back in."
        onCancel={() => setConfirmLogout(false)} onConfirm={logout} />
      <ToastHost />
    </div>
  )
}
