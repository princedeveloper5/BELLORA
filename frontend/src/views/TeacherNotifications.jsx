import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TeacherLayout from '@/components/TeacherLayout'
import api from '@/stores/api'
import {
  Archive,
  Bell,
  CalendarDays,
  CheckCheck,
  ExternalLink,
  Inbox,
  RefreshCw,
  Trash2
} from 'lucide-react'
import './TeacherNotifications.css'

const normalizeNotification = (notification) => ({
  id: notification.id || notification.notification_id,
  type: notification.type || 'notification',
  title: notification.title || 'Notification',
  message: notification.message || '',
  path: notification.path || '/teacher/dashboard',
  tone: notification.tone || 'blue',
  created_at: notification.created_at,
  read_at: notification.read_at || null,
  action_required: Boolean(notification.action_required)
})

const canDelete = (notification) => Number.isFinite(Number(notification?.id))

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(diff)) return ''
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString()
}

const formatFullDate = (timestamp) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TeacherNotifications() {
  const navigate = useNavigate()
  const location = useLocation()

  const querySelected = new URLSearchParams(location.search).get('selected')

  const [notifications, setNotifications] = useState([])
  const [selectedId, setSelectedId] = useState(querySelected || null)
  const [loading, setLoading] = useState(false)

  const selectedNotification = notifications.length
    ? notifications.find((notification) => String(notification.id) === String(selectedId)) || notifications[0]
    : null

  const unreadCount = notifications.filter((notification) => !notification.read_at).length
  const timetableCount = notifications.filter((notification) => {
    const text = `${notification.type || ''} ${notification.title || ''} ${notification.message || ''}`.toLowerCase()
    return text.includes('timetable') || text.includes('schedule')
  }).length

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await api.get('/notifications?limit=50', {
        showGlobalLoader: false,
        showGlobalNotification: false
      })
      const items = (response.data.notifications || []).map(normalizeNotification)
      setNotifications(items)
      if (!selectedId && items.length) setSelectedId(items[0].id)
    } catch (error) {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const markReadOnServer = async (notification) => {
    if (!canDelete(notification)) return
    try {
      await api.put(`/notifications/${notification.id}/read`, null, {
        showGlobalLoader: false,
        showGlobalNotification: false
      })
    } catch (error) {
      // Keep the interface responsive even if the read receipt fails.
    }
  }

  const selectNotification = async (notification) => {
    setSelectedId(notification.id)
    navigate(`/teacher/notifications?selected=${encodeURIComponent(notification.id)}`, { replace: true })
    if (!notification.read_at) {
      const readAt = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((item) => (String(item.id) === String(notification.id) ? { ...item, read_at: readAt } : item))
      )
      await markReadOnServer({ ...notification, read_at: readAt })
    }
  }

  const markAllRead = async () => {
    const readAt = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read_at: notification.read_at || readAt
      }))
    )
    try {
      await api.put('/notifications/read/all', null, {
        showGlobalLoader: false,
        showGlobalNotification: false
      })
    } catch (error) {
      // Local state remains marked read for the current session.
    }
  }

  const archiveNotification = async (notification) => {
    if (!canDelete(notification)) return
    try {
      await api.put(`/notifications/${notification.id}/archive`, null, {
        showGlobalLoader: false,
        showGlobalNotification: false
      })
      const next = notifications.filter((item) => String(item.id) !== String(notification.id))
      setNotifications(next)
      setSelectedId(next[0]?.id || null)
    } catch (error) {
      // Leave the item visible if the server did not archive it.
    }
  }

  const deleteNotification = async (notification) => {
    if (!canDelete(notification)) return
    try {
      await api.delete(`/notifications/${notification.id}`, {
        showGlobalLoader: false,
        showGlobalNotification: false
      })
      const next = notifications.filter((item) => String(item.id) !== String(notification.id))
      setNotifications(next)
      setSelectedId(next[0]?.id || null)
    } catch (error) {
      // Leave the item visible if delete fails.
    }
  }

  const openRelatedPage = (notification) => {
    navigate(notification.path || '/teacher/dashboard')
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    if (querySelected) setSelectedId(querySelected)
  }, [querySelected])

  return (
    <TeacherLayout>
      <div className="teacher-notifications-page">
        <section className="notifications-hero">
          <div>
            <span className="eyebrow">Teacher Notifications</span>
            <h1>Notification Panel</h1>
            <p>Timetable changes, school updates, and important alerts in one place.</p>
          </div>
          <div className="hero-actions">
            <button className="secondary-action" type="button" disabled={loading} onClick={loadNotifications}>
              <RefreshCw size={17} strokeWidth={2.2} aria-hidden="true" />
              Refresh
            </button>
            <button className="primary-action" type="button" disabled={!notifications.length} onClick={markAllRead}>
              <CheckCheck size={17} strokeWidth={2.2} aria-hidden="true" />
              Mark read
            </button>
          </div>
        </section>

        <section className="summary-grid" aria-label="Notification summary">
          <article>
            <Bell size={20} strokeWidth={2.2} aria-hidden="true" />
            <strong>{notifications.length}</strong>
            <span>Total</span>
          </article>
          <article>
            <Inbox size={20} strokeWidth={2.2} aria-hidden="true" />
            <strong>{unreadCount}</strong>
            <span>Unread</span>
          </article>
          <article>
            <CalendarDays size={20} strokeWidth={2.2} aria-hidden="true" />
            <strong>{timetableCount}</strong>
            <span>Timetable</span>
          </article>
        </section>

        <div className="notifications-layout">
          <section className="notifications-list-panel">
            <div className="panel-header">
              <div>
                <span>Inbox</span>
                <h2>Latest Alerts</h2>
              </div>
            </div>

            {loading && (
              <div className="loading-list">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index}></span>
                ))}
              </div>
            )}

            {!loading && !notifications.length && (
              <div className="empty-panel">
                <Inbox size={28} strokeWidth={2.1} aria-hidden="true" />
                <strong>No notifications yet</strong>
                <span>New timetable and school updates will appear here.</span>
              </div>
            )}

            {!loading &&
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-card${String(selectedId) === String(notification.id) ? ' active' : ''}${!notification.read_at ? ' unread' : ''}`}
                  onClick={() => selectNotification(notification)}
                >
                  <span className={`tone-dot ${notification.tone || 'blue'}`}></span>
                  <div>
                    <strong>{notification.title || 'Notification'}</strong>
                    <span>{notification.message || 'No message provided.'}</span>
                    <small>{formatTime(notification.created_at)}</small>
                  </div>
                </button>
              ))}
          </section>

          <section className="notification-detail-panel">
            {selectedNotification ? (
              <div className="detail-card">
                <div className="detail-head">
                  <span className={`detail-icon ${selectedNotification.tone || 'blue'}`}>
                    <Bell size={22} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <div>
                    <span>{selectedNotification.type || 'Update'}</span>
                    <h2>{selectedNotification.title}</h2>
                    <small>{formatFullDate(selectedNotification.created_at)}</small>
                  </div>
                </div>

                <p>{selectedNotification.message || 'No extra details are available for this notification.'}</p>

                <div className="detail-actions">
                  <button className="primary-action" type="button" onClick={() => openRelatedPage(selectedNotification)}>
                    <ExternalLink size={17} strokeWidth={2.2} aria-hidden="true" />
                    Open related page
                  </button>
                  <button className="secondary-action" type="button" onClick={() => archiveNotification(selectedNotification)}>
                    <Archive size={17} strokeWidth={2.2} aria-hidden="true" />
                    Archive
                  </button>
                  {canDelete(selectedNotification) && (
                    <button className="secondary-action" type="button" onClick={() => deleteNotification(selectedNotification)}>
                      <Trash2 size={17} strokeWidth={2.2} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-panel detail-empty">
                <Bell size={32} strokeWidth={2.1} aria-hidden="true" />
                <strong>Select a notification</strong>
                <span>Click any alert from the list to view its details here.</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </TeacherLayout>
  )
}
