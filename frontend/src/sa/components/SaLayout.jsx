import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, BookOpen, CalendarDays, CircleHelp, CircleUserRound, ChevronDown, LayoutDashboard,
  LogOut, Mail, MailCheck, Menu, Phone, School, ScrollText, Search, Settings, ShieldCheck, Users
} from 'lucide-react'
import AppSidebar from './AppSidebar'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import ToastHost from './ToastHost'
import { saStore, saActions, saSelectors } from '../store'
import { useStore } from '@/stores/useStore'
import { useAuthStore } from '@/stores/authStore'
import { initials } from '../format'
import { routeMeta } from '@/router/meta'
import { useClickOutside } from '@/hooks/useClickOutside'
import useSidebarState from '@/hooks/useSidebarState'
import { resolveAssetUrl } from '@/utils/resolveAssetUrl'
import '../sa.css'

const footerItems = [
  { label: 'Settings', to: '/super-admin/settings', icon: Settings }
]

const profileLinks = [
  { label: 'My Profile', to: '/super-admin/profile', icon: CircleUserRound },
  { label: 'Account Settings', to: '/super-admin/settings', icon: Settings },
  { label: 'Security', to: '/super-admin/profile?tab=security', icon: ShieldCheck }
]

export default function SaLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const store = useStore(saStore)
  const auth = useAuthStore()

  useEffect(() => {
    document.body.classList.remove('admin-dark-mode', 'teacher-dark-mode', 'dark')
  }, [])

  useEffect(() => {
    saActions.bootstrap()
  }, [])

  const [confirmLogout, setConfirmLogout] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchBox = useRef(null)
  const profileBox = useRef(null)
  const { collapsed, drawer, toggleSidebar, closeDrawer } = useSidebarState()

  useClickOutside(searchBox, () => setSearchOpen(false))
  useClickOutside(profileBox, () => setProfileOpen(false))

  const adminName = auth.user?.name || auth.user?.full_name || 'Super Admin'
  const adminEmail = auth.user?.email || 'admin@school.com'
  const adminInitials = initials(adminName)
  const { title: pageTitle, crumb: breadcrumb } = routeMeta(location.pathname)

  const pendingSchools = saSelectors.pendingSchools(store)
  const pendingUsers = saSelectors.pendingUsers(store)
  const unreadCount = saSelectors.unreadCount(store)
  const pendingCount = saSelectors.pendingCount(store)
  const searchIndex = saSelectors.searchIndex(store)

  const navSections = [
    {
      label: 'Main',
      items: [{ label: 'Dashboard', to: '/super-admin/dashboard', icon: LayoutDashboard }]
    },
    {
      label: 'Management',
      items: [
        {
          label: 'School Management',
          icon: School,
          badge: pendingSchools.length || null,
          children: [
            { label: 'All Schools', to: '/super-admin/schools' },
            { label: 'Add School', to: '/super-admin/schools?new=1' },
            { label: 'Pending Schools', to: '/super-admin/approvals', badge: pendingSchools.length || null },
            { label: 'School Subscriptions', to: '/super-admin/schools?view=subscriptions' }
          ]
        },
        {
          label: 'User Management',
          icon: Users,
          badge: pendingUsers.length || null,
          children: [
            { label: 'All Users', to: '/super-admin/users' },
            { label: 'School Administrators', to: '/super-admin/users/administrators' },
            { label: 'Directors of Studies', to: '/super-admin/users/dos' }
          ]
        }
      ]
    },
    {
      label: 'System',
      items: [
        { label: 'Reports', to: '/super-admin/reports', icon: BookOpen },
        { label: 'Notifications', to: '/super-admin/notifications', icon: Bell, badge: unreadCount || null },
        { label: 'Activity Logs', to: '/super-admin/activity', icon: ScrollText }
      ]
    }
  ]

  const searchResults = (() => {
    const q = query.toLowerCase()
    if (!q) return []
    return searchIndex
      .filter((r) => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q))
      .slice(0, 9)
  })()

  const goResult = (r) => {
    setSearchOpen(false)
    setQuery('')
    navigate(r.link)
  }

  const logout = () => {
    setConfirmLogout(false)
    auth.logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#1D2B3A]">
      <AppSidebar
        sections={navSections}
        footerItems={footerItems}
        profileTo="/super-admin/profile"
        userName={adminName}
        roleLabel="Super Admin"
        collapsed={collapsed}
        drawer={drawer}
        onNavigate={closeDrawer}
        onLogout={() => setConfirmLogout(true)}
        logoUrl={resolveAssetUrl(store.settings?.school_logo_url) || `${import.meta.env.BASE_URL}bellora-logo.svg`}
        logoAlt={store.settings?.school_logo_url ? 'School logo' : 'BELLORA logo'}
        logoLabel="BELLORA"
        logoSubtitle="Super Admin Console"
      />

      {drawer ? (
        <div className="fixed inset-0 z-30 bg-[#071D33]/50 lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      ) : null}

      <div className={`flex flex-col min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 h-[68px] bg-white/95 backdrop-blur border-b border-[#D8E5EC] flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
          <button
            type="button"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors shrink-0"
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
          >
            <Menu size={19} />
          </button>

          <div className="min-w-0 hidden md:block">
            <h1 className="text-[15px] font-bold truncate leading-5">{pageTitle}</h1>
            <p className="text-[11.5px] text-[#829AB1] truncate">{breadcrumb}</p>
          </div>

          <div className="relative mx-auto w-full max-w-md" ref={searchBox}>
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#829AB1] pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.trim())}
              type="search"
              role="combobox"
              aria-expanded={searchOpen}
              aria-label="Global search"
              placeholder="Search schools, users, subjects, timetables…"
              className="w-full h-10 rounded-full bg-[#F4F7FB] border border-transparent pl-10 pr-4 text-[13.5px] placeholder:text-[#829AB1] focus:outline-none focus:bg-white focus:border-[#0F9D8A] focus:ring-4 focus:ring-[#0F9D8A]/10 transition"
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false)
                if (e.key === 'Enter' && searchResults.length) goResult(searchResults[0])
              }}
            />
            {searchOpen && query ? (
              <div className="absolute left-0 right-0 top-12 rounded-xl border border-[#DCE5F0] bg-white shadow-[0_16px_40px_rgba(15,37,73,0.16)] overflow-hidden z-50">
                {searchResults.length ? (
                  <div className="max-h-[340px] overflow-y-auto py-1.5">
                    {searchResults.map((r) => (
                      <button
                        key={r.kind + r.label}
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f8fd] text-left transition"
                        onClick={() => goResult(r)}
                      >
                        <span className={`sa-search-kind k-${r.kind.toLowerCase()}`}>{r.kind}</span>
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

          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
            <Link to="/super-admin/notifications" className="sa-icon-btn" aria-label="Notifications" title="Notifications">
              <Bell size={18} />
              {unreadCount ? (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#ef4444] text-white text-[9.5px] font-bold grid place-items-center">
                  {unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              to="/super-admin/approvals"
              className="sa-icon-btn hidden sm:inline-flex"
              aria-label="Pending approvals"
              title="Pending approvals"
            >
              <MailCheck size={18} />
              {pendingCount ? (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#f59e0b] text-white text-[9.5px] font-bold grid place-items-center">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              className="sa-icon-btn hidden sm:inline-flex"
              aria-label="Help and support"
              title="Help & support"
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={18} />
            </button>

            <div className="relative ml-1" ref={profileBox}>
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-full pl-1 pr-2 sm:pr-3 py-1 hover:bg-[#f1f5fb] transition"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Account menu"
                onClick={() => setProfileOpen((v) => !v)}
              >
                <span className="relative">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0F9D8A] to-[#12304A] text-white grid place-items-center text-[13px] font-bold">
                    {adminInitials}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#18B981] border-2 border-white" title="Online" />
                </span>
                <span className="hidden lg:block text-left leading-tight">
                  <span className="block text-[13px] font-bold text-[#102A43]">{adminName}</span>
                  <span className="block text-[10.5px] text-[#829AB1] font-medium">Super Admin</span>
                </span>
                <ChevronDown size={14} className="hidden lg:block text-[#829AB1]" />
              </button>
              {profileOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-12 w-56 rounded-xl border border-[#DCE5F0] bg-white shadow-[0_16px_40px_rgba(15,37,73,0.16)] py-1.5 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-[#eef2f9] mb-1">
                    <p className="text-[13px] font-bold text-[#102A43]">{adminName}</p>
                    <p className="text-[11.5px] text-[#829AB1] truncate">{adminEmail}</p>
                  </div>
                  {profileLinks.map((l) => {
                    const Icon = l.icon
                    return (
                      <Link
                        key={l.label}
                        to={l.to}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-[#102A43] hover:bg-[#f4f8fd] transition"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Icon size={15} />
                        {l.label}
                      </Link>
                    )
                  })}
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-[#EF4444] hover:bg-[#fef2f2] transition"
                    onClick={() => {
                      setProfileOpen(false)
                      setConfirmLogout(true)
                    }}
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="grow p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>

        <footer className="px-6 py-4 text-center text-[11.5px] text-[#829AB1] border-t border-[#e8eef7]">
          BELLORA Timetable Management System · Super Admin Console · {new Date().getFullYear()}
        </footer>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        danger
        confirmLabel="Sign out"
        message="You will be signed out of the Super Admin console and will need your credentials to sign back in."
        onCancel={() => setConfirmLogout(false)}
        onConfirm={logout}
      />

      <Modal open={helpOpen} title="Help & Support" subtitle="We are here to help you run the platform" onClose={() => setHelpOpen(false)}>
        <div className="space-y-3 text-[13.5px] text-[#102A43]">
          <p className="leading-relaxed">
            This console gives the Super Admin full control over schools, users, academic structures and timetables
            across the BELLORA platform.
          </p>
          <div className="rounded-xl bg-[#f4f8fd] border border-[#DCE5F0] p-4 space-y-2.5">
            <p className="flex items-center gap-2.5">
              <Mail size={15} className="text-[#0F9D8A]" /> Email:{' '}
              <a className="text-[#0F9D8A] font-semibold" href={`mailto:${store.settings.supportEmail}`}>
                {store.settings.supportEmail}
              </a>
            </p>
            <p className="flex items-center gap-2.5">
              <Phone size={15} className="text-[#0F9D8A]" /> Phone: +250 788 000 000 (Mon–Fri, 8:00–17:00 CAT)
            </p>
            <p className="flex items-center gap-2.5">
              <BookOpen size={15} className="text-[#0F9D8A]" /> Docs: Platform administration handbook, v1.0
            </p>
          </div>
        </div>
      </Modal>

      <ToastHost />
    </div>
  )
}
