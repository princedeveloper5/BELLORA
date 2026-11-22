import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Trash2, Check, BellOff, School, UserRound, TriangleAlert, Crown, Server, CalendarClock } from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import EmptyState from '@/sa/components/EmptyState'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { saStore, saActions, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { timeAgo } from '@/sa/format'

const tone = (t) => ({
  approval: { bg: 'bg-[#FFF7E6] text-[#b07409]', icon: School },
  user: { bg: 'bg-[#E8F8F2] text-[#0E9F70]', icon: UserRound },
  conflict: { bg: 'bg-[#FEECEC] text-[#c62525]', icon: TriangleAlert },
  subscription: { bg: 'bg-[#F0EEFF] text-[#6D5CE7]', icon: Crown },
  school: { bg: 'bg-[#EAF3FF] text-[#1769E0]', icon: School },
  timetable: { bg: 'bg-[#e0f7fb] text-[#0e7490]', icon: CalendarClock },
  system: { bg: 'bg-[#eef2f9] text-[#475569]', icon: Server }
}[t] || { bg: 'bg-[#eef2f9] text-[#475569]', icon: Server })

export default function SaNotifications() {
  const navigate = useNavigate()
  const store = useStore(saStore)
  const [filter, setFilter] = useState('all')
  const [confirmClear, setConfirmClear] = useState(false)

  const unreadCount = saSelectors.unreadCount(store)

  const tabs = [
    { value: 'all', label: 'All', count: store.notifications.length },
    { value: 'unread', label: 'Unread', count: unreadCount },
    { value: 'approval', label: 'Approvals', count: store.notifications.filter((n) => n.type === 'approval').length },
    { value: 'conflict', label: 'Conflicts', count: store.notifications.filter((n) => n.type === 'conflict').length },
    { value: 'system', label: 'System', count: store.notifications.filter((n) => n.type === 'system').length }
  ]

  const filtered = store.notifications.filter((n) => {
    if (filter === 'unread') return !n.read
    if (filter === 'all') return true
    return n.type === filter
  })

  function openNotification(n) {
    saActions.markRead(n.id)
    if (n.link) navigate(n.link)
  }
  function markAll() {
    saActions.markAllRead()
    saActions.success('All notifications marked as read.')
  }
  function clearRead() {
    saActions.clearReadNotifications()
    saActions.success('Read notifications cleared.')
    setConfirmClear(false)
  }

  return (
    <SaLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Notifications</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">{unreadCount} unread of {store.notifications.length} total</p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" disabled={!unreadCount} onClick={markAll}><CheckCheck size={15} /> Mark all as read</button>
          <button type="button" className="sa-btn ghost !text-[#EF4444] !border-[#f3caca]" disabled={unreadCount === store.notifications.length} onClick={() => setConfirmClear(true)}><Trash2 size={15} /> Clear read</button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.value} type="button" className={`sa-tab ${filter === t.value ? 'on' : ''}`} onClick={() => setFilter(t.value)}>
            {t.label} <span className="opacity-70 tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="space-y-2.5">
          {filtered.map((n) => {
            const t = tone(n.type)
            const Icon = t.icon
            return (
              <article key={n.id}
                className={`sa-card px-4 sm:px-5 py-4 flex items-start gap-3.5 transition hover:shadow-[0_6px_18px_rgba(15,37,73,0.07)] ${!n.read ? 'border-l-[3px] !border-l-[#1769E0]' : ''}`}>
                <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 mt-0.5 ${t.bg}`}>
                  <Icon size={18} />
                </span>
                <button type="button" className="min-w-0 grow text-left" onClick={() => openNotification(n)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-bold text-[#102A43]">{n.title}</h3>
                    {!n.read ? <span className="w-2 h-2 rounded-full bg-[#1769E0]" aria-label="Unread" /> : null}
                  </div>
                  <p className="text-[13px] text-[#627D98] mt-0.5 leading-snug">{n.message}</p>
                  <time className="text-[11.5px] text-[#829AB1] mt-1 block">{timeAgo(n.createdAt)}</time>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.read ? <button type="button" className="sa-icon-btn !w-8 !h-8" aria-label={`Mark “${n.title}” as read`} title="Mark as read" onClick={() => saActions.markRead(n.id)}><Check size={15} /></button> : null}
                  <button type="button" className="sa-icon-btn !w-8 !h-8 hover:!text-[#EF4444]" aria-label={`Delete “${n.title}”`} title="Delete" onClick={() => saActions.deleteNotification(n.id)}><Trash2 size={15} /></button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="sa-card">
          <EmptyState icon={BellOff} title="No notifications" message={filter === 'unread' ? 'You have read everything. Nice work!' : 'Platform alerts will appear here.'} />
        </div>
      )}

      <ConfirmDialog open={confirmClear} title="Clear read notifications?" danger confirmLabel="Clear read"
        message="All notifications you have already read will be permanently removed. Unread notifications are kept."
        onCancel={() => setConfirmClear(false)} onConfirm={clearRead} />
    </SaLayout>
  )
}
