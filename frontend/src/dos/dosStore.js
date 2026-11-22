// ============================================================================
// PANTA Director of Studies — school-scoped store.
// All data comes from the backend, always restricted to the DOS's own school
// (enforced server-side by the school-isolation middleware).
//
// `silent` opts console requests out of the legacy global notification
// interceptor (lib/api.js) — this store renders its own toasts.
// ============================================================================

import { createStore } from '@/stores/createStore'
import api from '@/lib/api'

const silent = (config = {}) => ({ showGlobalNotification: false, showGlobalLoader: false, ...config })

const arr = (r, ...keys) => {
  for (const k of keys) {
    if (Array.isArray(r?.data?.[k])) return r.data[k]
  }
  return Array.isArray(r?.data) ? r.data : []
}

let toastSeq = 1

export const dosStore = createStore({
  ready: false,
  loading: false,
  error: '',
  overview: null,
  week: [],
  groups: [],
  entries: [],
  conflicts: [],
  teachers: [],
  classes: [],
  subjects: [],
  rooms: [],
  assignments: [],
  notifications: [],
  toasts: []
})

const patch = (partial) => dosStore.setState(partial)

export const dosSelectors = {
  publishedGroups: (state = dosStore.getState()) => state.groups.filter((g) => g.status === 'published'),
  draftGroups: (state = dosStore.getState()) => state.groups.filter((g) => g.status === 'draft'),
  unreadCount: (state = dosStore.getState()) => state.notifications.filter((n) => !n.read).length,
  searchIndex(state = dosStore.getState()) {
    const teachers = state.teachers.map((t) => ({
      kind: 'Teacher',
      label: t.name,
      sub: t.email || '',
      to: '/dos/teachers'
    }))
    const classes = state.classes.map((c) => ({
      kind: 'Class',
      label: c.class_name,
      sub: `${c.student_count} students`,
      to: '/dos/classes'
    }))
    const subjects = state.subjects.map((s) => ({
      kind: 'Subject',
      label: s.module_name,
      sub: s.department || '',
      to: '/dos/subjects'
    }))
    return [...teachers, ...classes, ...subjects]
  }
}

export const dosActions = {
  toast(type, message, title) {
    const id = toastSeq++
    patch((state) => ({ toasts: [...state.toasts, { id, type, message, title }] }))
    setTimeout(() => {
      patch((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4200)
  },

  success(message, title) {
    dosActions.toast('success', message, title)
  },

  error(message, title) {
    dosActions.toast('error', message, title)
  },

  apiError(error, fallback = 'Action failed') {
    dosActions.error(error?.response?.data?.message || error?.message || fallback, 'Error')
  },

  async bootstrap({ force = false } = {}) {
    const state = dosStore.getState()
    if ((state.ready && !force) || state.loading) return
    patch({ loading: true, error: '' })

    try {
      const [overview, week, groups, conflicts, teachers, classes, subjects, rooms, assignments, notifications] =
        await Promise.all([
          api.get('/dos-console/overview', silent()).then((r) => r.data),
          api.get('/dos-console/week', silent()).then((r) => r.data.items || []),
          api.get('/dos-console/groups', silent()).then((r) => r.data.items || []),
          api.get('/dos-console/conflicts', silent()).then((r) => r.data.items || []),
          api.get('/teachers', silent()).then((r) => arr(r, 'teachers', 'items')),
          api.get('/dos-console/classes', silent()).then((r) => r.data.items || []),
          api.get('/modules', silent()).then((r) => arr(r, 'modules', 'items')),
          api.get('/rooms', silent()).then((r) => arr(r, 'rooms', 'items')),
          api.get('/assignments', silent()).then((r) => arr(r, 'assignments', 'items')),
          api
            .get('/notifications', silent())
            .then((r) =>
              arr(r, 'notifications', 'items').map((n) => ({
                id: n.notification_id || n.id,
                type: n.type || 'system',
                title: n.title,
                message: n.message,
                link: n.path || '/dos/dashboard',
                read: !!n.read_at,
                createdAt: n.created_at
              }))
            )
            .catch(() => [])
        ])

      patch({
        overview,
        week,
        groups,
        conflicts,
        teachers,
        classes,
        subjects,
        rooms,
        assignments,
        notifications: notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      })
    } catch (error) {
      patch({ error: error?.response?.data?.message || 'Could not load your school data.' })
      dosActions.apiError(error, 'Could not load your school data')
    } finally {
      patch({ ready: true, loading: false })
    }
  },

  async markNotificationRead(notification) {
    patch((state) => ({
      notifications: state.notifications.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    }))
    try {
      await api.put(`/notifications/${notification.id}/read`, {}, silent())
    } catch {
      /* optimistic */
    }
  },

  async markAllNotificationsRead() {
    patch((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }))
    try {
      await api.put('/notifications/read/all', {}, silent())
    } catch {
      /* optimistic */
    }
  },

  async refreshGroups() {
    patch({ groups: await api.get('/dos-console/groups', silent()).then((r) => r.data.items || []) })
  },

  async refreshConflicts() {
    patch({ conflicts: await api.get('/dos-console/conflicts', silent()).then((r) => r.data.items || []) })
  },

  async refreshOverview() {
    patch({ overview: await api.get('/dos-console/overview', silent()).then((r) => r.data) })
  },

  async loadEntries(group) {
    patch({
      entries: await api
        .get('/dos-console/entries', silent({ params: { academic_year: group.academic_year, term: group.term } }))
        .then((r) => r.data.items || [])
    })
  },

  async setGroupStatus(group, status) {
    await api.put('/dos-console/group-status', { academic_year: group.academic_year, term: group.term, status }, silent())
    await Promise.all([dosActions.refreshGroups(), dosActions.refreshConflicts(), dosActions.refreshOverview()])
  },

  async generate({ academic_year, term, periods_per_class = 24 }) {
    const result = await api
      .post('/dos-console/generate', { academic_year, term, periods_per_class }, silent())
      .then((r) => r.data)
    await Promise.all([dosActions.refreshGroups(), dosActions.refreshOverview()])
    return result
  },

  // ---- CRUD wrappers (teachers / classes / subjects / roster / constraints) ----
  async createTeacher(body) {
    const r = await api.post('/dos-console/teachers', body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async updateTeacher(id, body) {
    const r = await api.put(`/dos-console/teachers/${id}`, body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async setTeacherAvailability(id, body) {
    const r = await api.put(`/dos-console/teachers/${id}/availability`, body, silent())
    return r.data
  },
  async deleteTeacher(id) {
    const r = await api.delete(`/dos-console/teachers/${id}`, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async createClass(body) {
    const r = await api.post('/dos-console/classes', body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async updateClass(id, body) {
    const r = await api.put(`/dos-console/classes/${id}`, body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async deleteClass(id) {
    const r = await api.delete(`/dos-console/classes/${id}`, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async createSubject(body) {
    const r = await api.post('/dos-console/subjects', body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async updateSubject(id, body) {
    const r = await api.put(`/dos-console/subjects/${id}`, body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async deleteSubject(id) {
    const r = await api.delete(`/dos-console/subjects/${id}`, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  getRoster: (classId) =>
    api.get(`/dos-console/classes/${classId}/students`, silent()).then((r) => r.data.items || []),
  getUnassignedStudents: () =>
    api.get('/dos-console/students/unassigned', silent()).then((r) => r.data.items || []),
  async enrollStudent(studentId, classId) {
    return api.put(`/dos-console/students/${studentId}/enroll`, { class_id: classId }, silent()).then((r) => r.data)
  },
  async unenrollStudent(studentId) {
    return api.put(`/dos-console/students/${studentId}/unenroll`, {}, silent()).then((r) => r.data)
  },
  // ---- Rooms & teaching assignments ----
  async createRoom(body) {
    const r = await api.post('/rooms', body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async updateRoom(id, body) {
    const r = await api.put(`/rooms/${id}`, body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async deleteRoom(id) {
    const r = await api.delete(`/rooms/${id}`, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async createAssignment(body) {
    const r = await api.post('/assignments', body, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  async deleteAssignment(id) {
    const r = await api.delete(`/assignments/${id}`, silent())
    await dosActions.bootstrap({ force: true })
    return r.data
  },
  getActivity: () => api.get('/dos-console/activity', silent()).then((r) => r.data.items || []),
  getConstraints: () => api.get('/dos-console/constraints', silent()).then((r) => r.data),
  async saveConstraints(body) {
    return api.put('/dos-console/constraints', body, silent()).then((r) => r.data)
  },
  async moveEntry(id, body) {
    return api.put(`/dos-console/entries/${id}/move`, body, silent()).then((r) => r.data)
  },
  async deleteEntry(id) {
    return api.delete(`/dos-console/entries/${id}`, silent()).then((r) => r.data)
  },
  getSuggestions: (entryId) => api.get(`/dos-console/entries/${entryId}/suggestions`, silent()).then((r) => r.data),

  // Auto-resolve one conflict: move the first clashing entry to its first free slot.
  async autoResolveConflict(conflict) {
    const entryId = conflict.entryIds[0]
    const { suggestions } = await dosActions.getSuggestions(entryId)
    if (!suggestions?.length) {
      return { resolved: false, reason: 'No conflict-free slot available for this lesson.' }
    }
    await dosActions.moveEntry(entryId, suggestions[0])
    await Promise.all([dosActions.refreshConflicts(), dosActions.refreshOverview()])
    return { resolved: true, slot: suggestions[0] }
  }
}
