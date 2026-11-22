import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, Info, Megaphone, TriangleAlert } from 'lucide-react'
import { dosStore, dosActions } from '../dosStore'
import { useStore } from '@/stores/useStore'
import { timeAgo } from '@/sa/format'
import { useClickOutside } from '@/hooks/useClickOutside'

const tone = (t) =>
  ({
    timetable: 'bg-[#cffafe] text-[#0e7490]',
    conflict: 'bg-[#FEECEC] text-[#b91c1c]',
    announcement: 'bg-[#fdeecd] text-[#b45309]'
  })[t] || 'bg-[#eef2f9] text-[#627D98]'

const iconFor = (t) => ({ timetable: CalendarClock, conflict: TriangleAlert, announcement: Megaphone })[t] || Info

export default function NotificationMenu() {
  const state = useStore(dosStore)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useClickOutside(root, () => setOpen(false))

  const unread = state.notifications.filter((n) => !n.read).length

  const openNotification = (n) => {
    dosActions.markNotificationRead(n)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="sa-icon-btn"
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread ? (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#ef4444] text-white text-[9.5px] font-bold grid place-items-center">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-12 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--panta-border)] bg-white shadow-[0_16px_40px_rgba(15,37,73,0.16)] z-50 overflow-hidden"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-[#eef2f9]">
            <p className="text-[13.5px] font-bold text-[var(--panta-text)]">Notifications</p>
            <button
              type="button"
              className="text-[11.5px] font-semibold text-[var(--panta-teal)] hover:underline disabled:opacity-40"
              disabled={!unread}
              onClick={() => dosActions.markAllNotificationsRead()}
            >
              Mark all as read
            </button>
          </header>
          <div className="max-h-[320px] overflow-y-auto">
            {state.notifications.slice(0, 8).map((n) => {
              const Icon = iconFor(n.type)
              return (
                <button
                  key={n.id}
                  type="button"
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#f6fbfa] transition border-b border-[#f4f7fa] last:border-0"
                  onClick={() => openNotification(n)}
                >
                  <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 ${tone(n.type)}`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block text-[12.5px] font-semibold text-[var(--panta-text)] truncate">{n.title}</span>
                    <span className="block text-[11.5px] text-[var(--panta-muted)] line-clamp-2">{n.message}</span>
                    <span className="block text-[10.5px] text-[#829AB1] mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read ? <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--panta-teal)' }} /> : null}
                </button>
              )
            })}
            {!state.notifications.length ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-[var(--panta-muted)]">
                No notifications yet.
                <br />
                System updates will appear here.
              </p>
            ) : null}
          </div>
          <Link
            to="/notifications"
            className="block text-center py-2.5 text-[12px] font-semibold text-[var(--panta-teal)] hover:bg-[#f6fbfa] border-t border-[#eef2f9]"
            onClick={() => setOpen(false)}
          >
            View all
          </Link>
        </div>
      ) : null}
    </div>
  )
}
