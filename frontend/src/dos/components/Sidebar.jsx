import { resolveAssetUrl } from '@/utils/resolveAssetUrl'
import {
  BookOpen, Briefcase, CalendarClock, DoorOpen, FileBarChart, Layers,
  LayoutDashboard, ScrollText, Settings
} from 'lucide-react'
import AppSidebar from '@/sa/components/AppSidebar'
import { dosStore } from '../dosStore'
import { useStore } from '@/stores/useStore'
import { useAuthStore } from '@/stores/authStore'

export default function Sidebar({ collapsed = false, drawer = false, onNavigate, onLogout }) {
  const location = useLocation()
  const store = useStore(dosStore)
  const auth = useAuthStore()

  const userName = auth.user?.name || auth.user?.full_name || 'Director'

  const sections = [
    {
      label: 'Main',
      items: [{ label: 'Dashboard', to: '/dos/dashboard', icon: LayoutDashboard }]
    },
    {
      label: 'Management',
      items: [
        {
          label: 'Timetable Management',
          to: '/dos/timetables',
          icon: CalendarClock,
          badge: store.conflicts.length || null,
          active: () => location.pathname.startsWith('/dos/timetables')
        },
        { label: 'Teachers', to: '/dos/teachers', icon: Briefcase },
        { label: 'Classes', to: '/dos/classes', icon: Layers },
        { label: 'Subjects', to: '/dos/subjects', icon: BookOpen },
        { label: 'Rooms', to: '/dos/rooms', icon: DoorOpen }
      ]
    },
    {
      label: 'Insights',
      items: [
        { label: 'Academic Reports', to: '/dos/reports', icon: FileBarChart },
        { label: 'Activity Logs', to: '/dos/activity', icon: ScrollText }
      ]
    }
  ]

  const footerItems = [
    { label: 'Settings', to: '/dos/settings', icon: Settings }
  ]

  return (
    <AppSidebar
      sections={sections}
      footerItems={footerItems}
      profileTo="/dos/settings"
      userName={userName}
      roleLabel="Director of Studies"
      collapsed={collapsed}
      drawer={drawer}
      onNavigate={onNavigate}
      onLogout={onLogout}
      logoUrl={resolveAssetUrl(store.overview?.schoolLogo) || `${import.meta.env.BASE_URL}panta-logo.png`}
      logoAlt={store.overview?.schoolLogo ? 'School logo' : 'PANTA logo'}
      logoLabel={store.overview?.schoolName || 'PANTA'}
      logoSubtitle="Director of Studies"
    />
  )
}
