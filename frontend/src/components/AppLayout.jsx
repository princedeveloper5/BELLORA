import { useLocation } from 'react-router-dom'
import DashboardLayout from '@/dos/components/DashboardLayout'
import SaLayout from '@/sa/components/SaLayout'
import { useAuthStore } from '@/stores/authStore'

export default function AppLayout({ children }) {
  const location = useLocation()
  const authStore = useAuthStore()
  const userType = authStore.currentUserType || localStorage.getItem('userType')
  const usesDosConsole = ['dos', 'admin'].includes(userType) && !location.pathname.startsWith('/super-admin')

  if (usesDosConsole) {
    return <DashboardLayout>{children}</DashboardLayout>
  }

  return <SaLayout>{children}</SaLayout>
}
