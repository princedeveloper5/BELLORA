import { useEffect, useState } from 'react'
import { Bell, BellOff, CheckCheck, CircleAlert, Clock3, MessageSquare, RefreshCcw, Search, Trash2, X } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import './Notifications.css'

const formatNotificationTime = (dateValue) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  const seconds = Math.max(Math.floor((Date.now() - date.getTime()) / 1000), 0)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function Notifications() {
  const authStore = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState(null)
  const [selectedThread, setSelectedThread] = useState(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [deletingSeen, setDeletingSeen] = useState(false)
  const [deletingThread, setDeletingThread] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  const [messageStatus, setMessageStatus] = useState('')
  const [messageStatusType, setMessageStatusType] = useState('success')
  const [messageForm, setMessageForm] = useState({ subject: '', message: '' })

  const isSuperAdmin = authStore.currentUserType === 'super_admin' || authStore.currentUser?.role === 'super_admin'
  const actionCount = notifications.filter((item) => item.action_required).length
  const latestLabel = notifications[0]?.created_at ? formatNotificationTime(notifications[0].created_at) : '-'

  const isThreadSeen = (thread) => {
    if (!thread) return false
    return isSuperAdmin ? Boolean(thread.seen_by_super_admin_at) : Boolean(thread.seen_by_school_at)
  }

  const seenMessagesCount = messages.filter(isThreadSeen).length
  const selectedThreadSeen = selectedThread ? isThreadSeen(selectedThread) : false

  const filteredNotifications = notifications.filter((notification) => {
    const query = searchQuery.trim().toLowerCase()
    const searchable = [notification.title, notification.message, notification.type, notification.tone].filter(Boolean).join(' ').toLowerCase()
    const category = String(notification.category || notification.type || notification.tone || '').toLowerCase()
    const matchesQuery = !query || searchable.includes(query)
    const matchesFilter = filter === 'all' ||
      (filter === 'action' ? notification.action_required : category.includes(filter))
    return matchesQuery && matchesFilter
  })

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await api.get('/notifications?limit=50', { showGlobalNotification: false })
      setNotifications(response.data.notifications || [])
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (currentSelectedId) => {
    setMessagesLoading(true)
    try {
      const response = await api.get('/admin-messages', { showGlobalNotification: false })
      const nextMessages = response.data.messages || []
      setMessages(nextMessages)
      if (!currentSelectedId && nextMessages.length) {
        await selectThread(nextMessages[0])
      } else if (currentSelectedId) {
        const selected = nextMessages.find((item) => Number(item.message_id) === Number(currentSelectedId))
        if (selected) await selectThread(selected)
      }
    } finally {
      setMessagesLoading(false)
    }
  }

  const selectThread = async (thread) => {
    setSelectedMessageId(thread.message_id)
    const response = await api.get(`/admin-messages/${thread.message_id}`, { showGlobalNotification: false })
    setSelectedThread(response.data.thread)
    const seenResponse = await api.put(`/admin-messages/${thread.message_id}/seen`, null, { showGlobalNotification: false })
    const nextSelectedThread = seenResponse.data.thread || response.data.thread
    setSelectedThread(nextSelectedThread)
    setMessages((current) => current.map((item) => (Number(item.message_id) === Number(thread.message_id)
      ? { ...item, ...nextSelectedThread }
      : item)))
    setReplyMessage('')
  }

  const isMine = (message) => {
    if (!message) return false
    return isSuperAdmin ? message.sender_role === 'super_admin' : message.sender_role !== 'super_admin'
  }

  const sendMessage = async (event) => {
    if (event) event.preventDefault()
    setSendingMessage(true)
    setMessageStatus('')
    try {
      const response = await api.post('/admin-messages', messageForm, { showGlobalNotification: false })
      setMessageForm({ subject: '', message: '' })
      setMessageStatus(response.data.message || 'Message sent.')
      setMessageStatusType('success')
      await loadMessages()
    } catch (error) {
      setMessageStatus(error.response?.data?.message || 'Could not send message.')
      setMessageStatusType('error')
    } finally {
      setSendingMessage(false)
    }
  }

  const sendReply = async (event) => {
    if (event) event.preventDefault()
    if (!selectedThread) return
    setSendingReply(true)
    try {
      await api.post(`/admin-messages/${selectedThread.message_id}/replies`, {
        message: replyMessage
      }, { showGlobalNotification: false })
      await loadMessages()
    } finally {
      setSendingReply(false)
    }
  }

  const deleteSelectedThread = async () => {
    if (!selectedThread || !selectedThreadSeen) return
    setDeletingThread(true)
    try {
      const removedId = selectedThread.message_id
      await api.delete(`/admin-messages/${removedId}`, { showGlobalNotification: false })
      const nextMessages = messages.filter((item) => Number(item.message_id) !== Number(removedId))
      setMessages(nextMessages)
      setSelectedThread(null)
      setSelectedMessageId(null)
      if (nextMessages.length) await selectThread(nextMessages[0])
    } finally {
      setDeletingThread(false)
    }
  }

  const deleteSeenMessages = async () => {
    if (!seenMessagesCount) return
    setDeletingSeen(true)
    try {
      const selectedWasSeen = selectedThreadSeen
      await api.delete('/admin-messages/seen/all', { showGlobalNotification: false })
      const nextMessages = messages.filter((item) => !isThreadSeen(item))
      setMessages(nextMessages)
      if (selectedWasSeen) {
        setSelectedThread(null)
        setSelectedMessageId(null)
      }
      if (!selectedThread && nextMessages.length) await selectThread(nextMessages[0])
    } finally {
      setDeletingSeen(false)
    }
  }

  const canDelete = (notification) => /^\d+$/.test(String(notification.id))

  const deleteNotification = async (notification) => {
    if (!canDelete(notification)) return
    await api.delete(`/notifications/${notification.id}`)
    setNotifications((current) => current.filter((item) => String(item.id) !== String(notification.id)))
  }

  const clearNotifications = async () => {
    if (!notifications.length) return
    await api.delete('/notifications')
    setNotifications((current) => current.filter((item) => item.action_required))
  }

  const getPendingEndpoint = (notification, action) => {
    if (!notification?.entity_id) return ''
    if (notification.entity_type === 'school' || notification.type === 'school_pending') return `/schools/${notification.entity_id}/${action}`
    if (notification.entity_type === 'teacher' || notification.type === 'teacher_pending') {
      return action === 'approve' ? `/teachers/${notification.entity_id}/approve` : `/teachers/${notification.entity_id}/reject`
    }
    return ''
  }

  const approvePendingItem = async (notification) => {
    const endpoint = getPendingEndpoint(notification, 'approve')
    if (!endpoint) return
    await api.put(endpoint)
    await loadNotifications()
  }

  const rejectPendingItem = async (notification) => {
    const endpoint = getPendingEndpoint(notification, 'reject')
    if (!endpoint) return
    if (notification.entity_type === 'school' || notification.type === 'school_pending') {
      await api.put(endpoint)
    } else {
      await api.delete(endpoint)
    }
    await loadNotifications()
  }

  useEffect(() => {
    loadNotifications()
    loadMessages()
  }, [])

  return (
    <AppLayout>
      <main className="notifications-page">
        <header className="page-header">
          <div>
            <p>{isSuperAdmin ? 'Platform alerts' : 'School alerts'}</p>
            <h1>Notifications</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="ghost-btn" onClick={() => loadMessages(selectedMessageId)}>
              <MessageSquare size={17} aria-hidden="true" />
              <span>{isSuperAdmin ? 'Message inbox' : 'Admin messages'}</span>
            </button>
            <button type="button" className="ghost-btn" disabled={loading} onClick={loadNotifications}>
              <RefreshCcw size={17} aria-hidden="true" />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button type="button" className="danger-btn" disabled={!notifications.length} onClick={clearNotifications}>
              <Trash2 size={17} aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        </header>

        <section className="summary-grid">
          <article>
            <Bell size={21} aria-hidden="true" />
            <span>Total</span>
            <strong>{notifications.length}</strong>
          </article>
          <article>
            <CircleAlert size={21} aria-hidden="true" />
            <span>Needs Action</span>
            <strong>{actionCount}</strong>
          </article>
          <article>
            <Clock3 size={21} aria-hidden="true" />
            <span>Latest</span>
            <strong>{latestLabel}</strong>
          </article>
        </section>

        <section className="messages-panel">
          <div className="panel-head">
            <div>
              <h2>{isSuperAdmin ? 'Admin Message Inbox' : 'Message Super Admin'}</h2>
              <small>{isSuperAdmin ? 'Reply to messages from school administrators.' : 'Send a question or issue directly to Super Admin.'}</small>
            </div>
            <button type="button" className="ghost-btn" disabled={messagesLoading} onClick={() => loadMessages(selectedMessageId)}>
              <RefreshCcw size={16} aria-hidden="true" />
              <span>{messagesLoading ? 'Loading...' : 'Reload'}</span>
            </button>
            <button type="button" className="danger-btn" disabled={!seenMessagesCount || deletingSeen} onClick={deleteSeenMessages}>
              <Trash2 size={16} aria-hidden="true" />
              <span>{deletingSeen ? 'Deleting...' : 'Delete seen'}</span>
            </button>
          </div>

          {!isSuperAdmin && (
            <form className="message-form" onSubmit={sendMessage}>
              <label>
                <span>Subject</span>
                <input
                  value={messageForm.subject}
                  onChange={(event) => setMessageForm({ ...messageForm, subject: event.target.value })}
                  type="text"
                  required
                  placeholder="Example: Timetable generation issue"
                />
              </label>
              <label>
                <span>Message</span>
                <textarea
                  value={messageForm.message}
                  onChange={(event) => setMessageForm({ ...messageForm, message: event.target.value })}
                  rows="4"
                  required
                  placeholder="Write what you need help with..."
                ></textarea>
              </label>
              <div className="form-actions">
                {messageStatus ? <span className={messageStatusType}>{messageStatus}</span> : null}
                <button type="submit" disabled={sendingMessage}>{sendingMessage ? 'Sending...' : 'Send to Super Admin'}</button>
              </div>
            </form>
          )}

          {messagesLoading ? (
            <div className="loading-list">
              {[1, 2, 3].map((item) => (
                <span key={`message-loading-${item}`}></span>
              ))}
            </div>
          ) : !messages.length ? (
            <div className="empty-state compact">
              <MessageSquare size={30} aria-hidden="true" />
              <strong>No admin messages yet</strong>
              <small>{isSuperAdmin ? 'School admin messages will appear here.' : 'Your sent messages and replies will appear here.'}</small>
            </div>
          ) : (
            <div className="messages-layout">
              <div className="thread-list">
                {messages.map((thread) => (
                  <button
                    key={thread.message_id}
                    type="button"
                    className={selectedMessageId === thread.message_id ? 'active' : ''}
                    onClick={() => selectThread(thread)}
                  >
                    {!isThreadSeen(thread) ? <span className="unseen-dot" aria-label="Unseen message"></span> : null}
                    <strong>{thread.subject}</strong>
                    <span>{thread.sender_name || 'Admin'} - {thread.reply_count || 0} replies</span>
                    <small>{formatNotificationTime(thread.last_activity_at || thread.created_at)}</small>
                  </button>
                ))}
              </div>
              {selectedThread ? (
                <article className="thread-detail">
                  <header className="thread-header">
                    <div>
                      <span className={['thread-status', selectedThread.status].filter(Boolean).join(' ')}>{selectedThread.status}</span>
                      {selectedThreadSeen ? (
                        <span className="seen-pill">
                          <CheckCheck size={14} aria-hidden="true" />
                          Seen
                        </span>
                      ) : null}
                      <h3>{selectedThread.subject}</h3>
                      <small>{selectedThread.sender_name || 'Admin'} - {formatNotificationTime(selectedThread.created_at)}</small>
                    </div>
                    <button type="button" className="icon-btn danger-icon" disabled={!selectedThreadSeen || deletingThread} title="Delete seen message" onClick={deleteSelectedThread}>
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </header>
                  <div className="chat-body">
                    <div className={`message-bubble${isMine(selectedThread) ? ' mine' : ''}`}>
                      <strong>{selectedThread.sender_name || 'Admin'}</strong>
                      <p>{selectedThread.message}</p>
                      <small>{formatNotificationTime(selectedThread.created_at)}</small>
                    </div>
                    {(selectedThread.replies || []).map((reply) => (
                      <div key={reply.message_id} className={`message-bubble${isMine(reply) ? ' mine' : ''}`}>
                        <strong>{reply.sender_name || reply.sender_role || 'Admin'}</strong>
                        <p>{reply.message}</p>
                        <small>{formatNotificationTime(reply.created_at)}</small>
                      </div>
                    ))}
                  </div>
                  <form className="reply-form" onSubmit={sendReply}>
                    <textarea
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      rows="3"
                      required
                      placeholder="Write a reply..."
                    ></textarea>
                    <button type="submit" disabled={sendingReply}>{sendingReply ? 'Replying...' : 'Reply'}</button>
                  </form>
                </article>
              ) : null}
            </div>
          )}
        </section>

        <section className="notifications-panel">
          <div className="panel-toolbar">
            <div className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="search"
                placeholder="Search notifications..."
              />
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All notifications</option>
              <option value="action">Needs action</option>
              <option value="system">System</option>
              <option value="billing">Billing</option>
              <option value="security">Security</option>
            </select>
          </div>

          {loading ? (
            <div className="loading-list" role="status">
              {[1, 2, 3, 4, 5].map((item) => (
                <span key={item}></span>
              ))}
            </div>
          ) : !filteredNotifications.length ? (
            <div className="empty-state">
              <BellOff size={34} aria-hidden="true" />
              <strong>No notifications found</strong>
              <small>New requests, approvals, and system updates will appear here.</small>
            </div>
          ) : (
            <div className="notification-list">
              {filteredNotifications.map((notification) => (
                <article key={notification.id} className="notification-card">
                  <span className={`tone-dot ${notification.tone || 'blue'}`}></span>
                  <div className="notification-copy">
                    <strong>{notification.title}</strong>
                    {notification.message ? <p>{notification.message}</p> : null}
                    <small>{formatNotificationTime(notification.created_at)}</small>
                  </div>
                  <div className="notification-actions">
                    {notification.action_required ? (
                      <button type="button" className="approve-btn" onClick={() => approvePendingItem(notification)}>
                        Approve
                      </button>
                    ) : null}
                    {notification.action_required ? (
                      <button type="button" className="reject-btn" onClick={() => rejectPendingItem(notification)}>
                        Reject
                      </button>
                    ) : null}
                    {canDelete(notification) ? (
                      <button type="button" className="icon-btn" title="Delete" onClick={() => deleteNotification(notification)}>
                        <X size={17} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  )
}
