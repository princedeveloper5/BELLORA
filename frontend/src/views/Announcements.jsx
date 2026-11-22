import { useEffect, useState } from 'react'
import { CircleAlert, Clock3, Inbox, Megaphone, RefreshCcw, Search } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import './Announcements.css'

const formatRelative = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const minutes = Math.floor(Math.max(Date.now() - date.getTime(), 0) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const formatDate = (value) => {
  if (!value) return 'Date unavailable'
  return new Date(value).toLocaleString()
}

export default function Announcements() {
  const authStore = useAuthStore()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formMessageType, setFormMessageType] = useState('success')
  const [form, setForm] = useState({ title: '', priority: 'Normal', message: '' })

  const isSuperAdmin = authStore.currentUserType === 'super_admin' || authStore.currentUser?.role === 'super_admin'
  const urgentCount = announcements.filter((item) => item.priority === 'Urgent').length
  const latestLabel = announcements[0]?.created_at ? formatRelative(announcements[0].created_at) : '-'

  const filteredAnnouncements = announcements.filter((announcement) => {
    const query = searchQuery.trim().toLowerCase()
    const searchable = [announcement.title, announcement.message, announcement.priority].filter(Boolean).join(' ').toLowerCase()
    return (!query || searchable.includes(query)) &&
      (!priorityFilter || announcement.priority === priorityFilter)
  })

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const response = await api.get('/announcements?limit=100', { showGlobalNotification: false })
      setAnnouncements(response.data.announcements || [])
    } finally {
      setLoading(false)
    }
  }

  const sendAnnouncement = async (event) => {
    if (event) event.preventDefault()
    setSending(true)
    setFormMessage('')
    try {
      const response = await api.post('/announcements', {
        ...form,
        target_school_ids: []
      }, { showGlobalNotification: false })
      setAnnouncements((current) => [response.data.announcement, ...current].filter(Boolean))
      setForm({ title: '', priority: 'Normal', message: '' })
      setFormMessage(response.data.message || 'Announcement sent.')
      setFormMessageType('success')
    } catch (error) {
      setFormMessage(error.response?.data?.message || 'Could not send announcement.')
      setFormMessageType('error')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  return (
    <AppLayout>
      <main className="announcements-page">
        <header className="page-header">
          <div>
            <p>{isSuperAdmin ? 'Platform broadcast center' : 'School announcement board'}</p>
            <h1>Announcements</h1>
          </div>
          <button type="button" className="ghost-btn" disabled={loading} onClick={loadAnnouncements}>
            <RefreshCcw size={17} aria-hidden="true" />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </header>

        <section className="summary-grid">
          <article>
            <Megaphone size={22} aria-hidden="true" />
            <span>Total</span>
            <strong>{announcements.length}</strong>
          </article>
          <article>
            <CircleAlert size={22} aria-hidden="true" />
            <span>Urgent</span>
            <strong>{urgentCount}</strong>
          </article>
          <article>
            <Clock3 size={22} aria-hidden="true" />
            <span>Latest</span>
            <strong>{latestLabel}</strong>
          </article>
        </section>

        {isSuperAdmin && (
          <section className="composer-panel">
            <div className="panel-head">
              <h2>Send Announcement</h2>
              <small>Broadcast platform updates to schools.</small>
            </div>
            <form className="announcement-form" onSubmit={sendAnnouncement}>
              <label>
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  type="text"
                  required
                  placeholder="Example: Maintenance window"
                />
              </label>
              <label>
                <span>Priority</span>
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                  <option>Normal</option>
                  <option>Important</option>
                  <option>Urgent</option>
                </select>
              </label>
              <label className="wide">
                <span>Message</span>
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  rows="5"
                  required
                  placeholder="Write the announcement schools should see..."
                ></textarea>
              </label>
              <div className="form-actions wide">
                {formMessage ? <span className={formMessageType}>{formMessage}</span> : null}
                <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send to all schools'}</button>
              </div>
            </form>
          </section>
        )}

        <section className="announcements-panel">
          <div className="panel-toolbar">
            <div className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="search"
                placeholder="Search announcements..."
              />
            </div>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="">All priorities</option>
              <option>Normal</option>
              <option>Important</option>
              <option>Urgent</option>
            </select>
          </div>

          {loading ? (
            <div className="loading-list">
              {[1, 2, 3, 4, 5].map((item) => (
                <span key={item}></span>
              ))}
            </div>
          ) : !filteredAnnouncements.length ? (
            <div className="empty-state">
              <Inbox size={36} aria-hidden="true" />
              <strong>No announcements found</strong>
              <small>Announcements sent by Super Admin will appear here.</small>
            </div>
          ) : (
            <div className="announcement-list">
              {filteredAnnouncements.map((announcement) => (
                <article
                  key={announcement.announcement_id}
                  className={`announcement-card ${String(announcement.priority || 'Normal').toLowerCase()}`}
                >
                  <div>
                    <span className="priority">{announcement.priority || 'Normal'}</span>
                    <h2>{announcement.title}</h2>
                    <small>{formatDate(announcement.created_at)} · {announcement.target_count || 0} school{Number(announcement.target_count || 0) === 1 ? '' : 's'}</small>
                  </div>
                  <p>{announcement.message}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  )
}
