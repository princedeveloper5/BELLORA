import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import ToastViewport from '@/components/ToastViewport'
import { dosStore, dosActions } from '../dosStore'
import { useStore } from '@/stores/useStore'
import { useAuthStore } from '@/stores/authStore'
import useSidebarState from '@/hooks/useSidebarState'
import '../theme.css'
import '@/sa/sa.css'

export default function DashboardLayout({ children }) {
  const navigate = useNavigate()
  const store = useStore(dosStore)
  const auth = useAuthStore()

  useEffect(() => {
    document.body.classList.remove('admin-dark-mode', 'teacher-dark-mode', 'dark')
  }, [])

  useEffect(() => {
    dosActions.bootstrap()
  }, [])

  const [confirmLogout, setConfirmLogout] = useState(false)
  const { collapsed, drawer, toggleSidebar, closeDrawer } = useSidebarState()

  const logout = () => {
    setConfirmLogout(false)
    auth.logout()
    navigate('/login')
  }

  const dismissToast = (id) => dosStore.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))

  return (
    <div className="min-h-screen" style={{ background: 'var(--panta-bg)', color: 'var(--panta-text)' }}>
      <Sidebar
        id="dos-primary-navigation"
        collapsed={collapsed}
        drawer={drawer}
        onNavigate={closeDrawer}
        onLogout={() => setConfirmLogout(true)}
      />

      {drawer ? (
        <div className="fixed inset-0 z-30 bg-[#071D33]/50 lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      ) : null}

      <div className={`flex flex-col min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        <TopHeader
          onToggleSidebar={toggleSidebar}
          navigationExpanded={window.innerWidth < 1024 ? drawer : !collapsed}
          onLogout={() => setConfirmLogout(true)}
        />

        {store.error ? (
          <div
            className="mx-3 sm:mx-5 lg:mx-6 mt-4 rounded-xl border border-[#f5caca] bg-[#fef2f2] px-4 py-3 flex items-center gap-3"
            role="alert"
          >
            <TriangleAlert size={17} className="text-[#EF4444] shrink-0" />
            <p className="text-[13px] text-[#8a1f1f] grow">{store.error}</p>
            <button type="button" className="sa-btn sm panta-primary-btn" onClick={() => dosActions.bootstrap({ force: true })}>
              Retry
            </button>
          </div>
        ) : null}

        <main className="grow p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>

        <footer
          className="px-6 py-4 text-center text-[11.5px] border-t border-[var(--panta-border)]"
          style={{ color: 'var(--panta-muted)' }}
        >
          © {new Date().getFullYear()} BELLORA
        </footer>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        danger
        confirmLabel="Sign out"
        message="You will be signed out and will need your credentials to sign back in."
        onCancel={() => setConfirmLogout(false)}
        onConfirm={logout}
      />
      <ToastViewport toasts={store.toasts} onDismiss={dismissToast} />
    </div>
  )
}
