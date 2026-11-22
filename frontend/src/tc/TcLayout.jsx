import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarClock, Layers, BookOpen, ClipboardCheck,
  Timer, CircleUserRound, Menu, Search, Bell, GraduationCap, School, Settings
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useStore } from '@/stores/useStore'
import { initials } from '@/sa/format'
import AppSidebar from '@/sa/components/AppSidebar'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import ToastHost from '@/sa/components/ToastHost'
import { tcStore, tcActions } from './tcStore'
import { useClickOutside } from '@/hooks/useClickOutside'
import useSidebarState from '@/hooks/useSidebarState'
import { resolveAssetUrl } from '@/utils/resolveAssetUrl'
import '@/sa/sa.css'

const pageTitles = {
  '/teacher/dashboard': 'Dashboard',
  '/teacher/timetable': 'Timetable',
  '/teacher/attendance': 'Attendance',
  '/teacher/results': 'Results',
  '/teacher/notifications': 'Notifications',
  '/teacher/current-counter': 'Current Counter',
  '/teacher/profile': 'Profile',
  '/teacher/settings': 'Settings'
}

const nav = [
  {
    label: 'Main',
    items: [{ label: 'Dashboard', to: '/teacher/dashboard', icon: LayoutDashboard }]
  },
  {
    label: 'Teaching',
    items: [
      { label: 'My Timetable', to: '/teacher/timetable', icon: CalendarClock },
      { label: 'My Classes', to: '/teacher/dashboard?view=classes', icon: Layers, active: () => location.search === '?view=classes' },
      { label: 'Subjects', to: '/teacher/dashboard?view=subjects', icon: BookOpen, active: () => location.search === '?view=subjects' },
      { label: 'Results', to: '/teacher/results', icon: GraduationCap },
      { label: 'Attendance', to: '/teacher/attendance', icon: ClipboardCheck }
    ]
  },
  {
    label: 'System',
    items: [
      { label: 'Current Counter', to: '/teacher/current-counter', icon: Timer }
    ]
  }
]

const footerItems = [
  { label: 'Profile', to: '/teacher/profile', icon: CircleUserRound },
  { label: 'Settings', to: '/teacher/settings', icon: Settings }
]

export default function TcLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const store = useStore(tcStore)

  useEffect(() => {
    document.body.classList.remove('admin-dark-mode', 'teacher-dark-mode', 'dark')
  }, [])

  useEffect(() => {
    tcActions.bootstrap()
  }, [])

  const [confirmLogout, setConfirmLogout] = useState(false)
  const { collapsed, drawer, toggleSidebar, closeDrawer } = useSidebarState()

  const userName = store.overview?.teacher?.name || authStore.user?.name || 'Teacher'
  const pageTitle = pageTitles[location.pathname] || 'Dashboard'

  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBox = useRef(null)
  useClickOutside(searchBox, () => setSearchOpen(false))

  const searchIndex = useMemo(() => {
    const overview = store.overview
    if (!overview) return []
    const index = [
      { kind: 'Page', label: 'Dashboard', sub: 'Overview of your teaching', to: '/teacher/dashboard' },
      { kind: 'Page', label: 'My Timetable', sub: 'Weekly lesson schedule', to: '/teacher/timetable' },
      { kind: 'Page', label: 'Attendance', sub: 'Mark and review attendance', to: '/teacher/attendance' },
      { kind: 'Page', label: 'Results', sub: 'Enter and review scores', to: '/teacher/results' },
      { kind: 'Page', label: 'Current Counter', sub: 'Live period timer', to: '/teacher/current-counter' },
      { kind: 'Page', label: 'Notifications', sub: 'Announcements and alerts', to: '/teacher/notifications' },
      { kind: 'Page', label: 'Profile', sub: 'Your account details', to: '/teacher/profile' }
    ]
    ;(overview.classList || []).forEach((c) =>
      index.push({ kind: 'Class', label: c.class_name, sub: 'Class you teach', to: '/teacher/dashboard?view=classes' })
    )
    ;(overview.subjectList || []).forEach((s) =>
      index.push({ kind: 'Subject', label: s.module_name, sub: 'Subject you teach', to: '/teacher/dashboard?view=subjects' })
    )
    const seenLessons = new Set()
    ;(overview.week || []).forEach((lesson) => {
      const key = `${lesson.module_name}|${lesson.class_name}`
      if (seenLessons.has(key)) return
      seenLessons.add(key)
      index.push({
        kind: 'Lesson',
        label: `${lesson.module_name}${lesson.class_name ? ` · ${lesson.class_name}` : ''}`,
        sub: `${lesson.day_of_week} ${lesson.start_time}-${lesson.end_time}${lesson.room_name ? ` · ${lesson.room_name}` : ''}`,
        to: '/teacher/timetable'
      })
    })
    return index
  }, [store.overview])

  const searchResults = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return searchIndex.filter((r) => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)).slice(0, 8)
  })()

  const goSearch = (result) => {
    setSearchOpen(false)
    setQuery('')
    navigate(result.to)
  }

  const logout = () => {
    setConfirmLogout(false)
    authStore.logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#102A43]">
      {/* Sidebar (shared AppSidebar component) */}
      <AppSidebar
        sections={nav}
        footerItems={footerItems}
        profileTo="/teacher/profile"
        userName={userName}
        roleLabel="Teacher"
        collapsed={collapsed}
        drawer={drawer}
        onNavigate={closeDrawer}
        onLogout={() => setConfirmLogout(true)}
        logoUrl={resolveAssetUrl(store.overview?.schoolLogo) || `${import.meta.env.BASE_URL}panta-logo.png`}
        logoAlt={store.overview?.schoolLogo ? 'School logo' : 'PANTA logo'}
        logoLabel={store.overview?.schoolName || 'PANTA'}
        logoSubtitle="Teacher Portal"
      />

      {drawer ? (
        <div className="fixed inset-0 z-30 bg-[#071D33]/50 lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      ) : null}

      <div className={`flex flex-col min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 h-[68px] bg-white/95 backdrop-blur border-b border-[#DCE5F0] flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
          <button type="button" className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors shrink-0" aria-label="Toggle sidebar" onClick={toggleSidebar}>
            <Menu size={19} />
          </button>
          <div className="min-w-0 hidden md:block">
            <h1 className="text-[15px] font-bold truncate leading-5">
              Home <span className="text-[#C6D4E3] mx-0.5">/</span> <span className="text-[#1769E0]">{pageTitle}</span>
            </h1>
            <p className="text-[11.5px] text-[#829AB1] truncate flex items-center gap-1">
              <School size={10} className="shrink-0" />{store.overview?.schoolName || 'My School'}
              {store.overview?.activeYear ? (
                <span className="ml-1 inline-flex items-center rounded-full px-2 py-[1px] text-[9.5px] font-extrabold bg-[#EAF3FF] text-[#1769E0]">
                  {store.overview.activeYear}
                  {store.overview?.activeTerm ? <span> · {store.overview.activeTerm}</span> : null}
                </span>
              ) : null}
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-md" ref={searchBox}>
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#829AB1] pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              role="combobox"
              aria-expanded={searchOpen}
              aria-label="Search classes, subjects, lessons"
              placeholder="Search classes, subjects, lessons…"
              className="w-full h-10 rounded-full bg-[#F4F7FB] border border-transparent pl-10 pr-4 text-[13.5px] placeholder:text-[#829AB1] focus:outline-none focus:bg-white focus:border-[#0F9D8A] focus:ring-4 focus:ring-[#0F9D8A]/10 transition"
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false)
                if (e.key === 'Enter' && searchResults.length) goSearch(searchResults[0])
              }}
            />
            {searchOpen && query ? (
              <div className="absolute left-0 right-0 top-12 rounded-xl border border-[#DCE5F0] bg-white shadow-[0_16px_40px_rgba(15,37,73,0.16)] overflow-hidden z-50">
                {searchResults.length ? (
                  <div className="max-h-[300px] overflow-y-auto py-1.5">
                    {searchResults.map((r) => (
                      <button
                        key={r.kind + r.label}
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f6fbfa] text-left transition"
                        onClick={() => goSearch(r)}
                      >
                        <span className="shrink-0 text-[9.5px] font-extrabold tracking-wide px-2 py-[3px] rounded-md uppercase bg-[#E7F5F2] text-[#0B7F70]">
                          {r.kind}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-[#102A43] truncate">{r.label}</span>
                          <span className="block text-[11.5px] text-[#829AB1] truncate">{r.sub}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-center text-[13px] text-[#829AB1]">No results for “{query}”.</p>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Link to="/teacher/notifications" className="sa-icon-btn" aria-label="Notifications" title="Notifications"><Bell size={18} /></Link>
            <Link to="/teacher/profile" className="flex items-center gap-2.5 rounded-full pl-1 pr-2 sm:pr-3 py-1 hover:bg-[#f1f5fb] transition" aria-label="My profile">
              <span className="relative">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1769E0] to-[#0B2A4A] text-white grid place-items-center text-[13px] font-bold">{initials(userName)}</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#18B981] border-2 border-white"></span>
              </span>
              <span className="hidden lg:block text-left leading-tight">
                <span className="block text-[13px] font-bold text-[#102A43]">{userName}</span>
                <span className="block text-[10.5px] text-[#829AB1] font-medium">Teacher</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="grow p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
        <footer className="px-6 py-4 text-center text-[11.5px] text-[#829AB1] border-t border-[#e8eef7]">
          PANTA Timetable Management System · Teacher Portal · {new Date().getFullYear()}
        </footer>
      </div>

      <ConfirmDialog open={confirmLogout} title="Sign out?" danger confirmLabel="Sign out"
        message="You will be signed out and will need your credentials to sign back in."
        onCancel={() => setConfirmLogout(false)} onConfirm={logout} />
      <ToastHost />
    </div>
  )
}
