// ============================================================================
// PANTA Super Admin — central store.
//
// API-FIRST: all data comes from the real backend (/api/sa/*, /api/schools/*,
// /api/notifications/*). Mutations call the backend first; local state is
// updated from the server response. Errors surface as toasts.
//
// OFFLINE FALLBACK: if the backend is unreachable during bootstrap, the store
// loads the built-in demo dataset (sa/db.js) so screens remain reviewable —
// `offline` is set and a persistent warning toast makes the mode explicit.
// ============================================================================

import { createStore } from '@/stores/createStore'
import { saApi, groupKey } from './api'
import { loadDb, persistDb, resetDb } from './db'
import { uid, overlaps, SLOTS, DAYS } from './format'

let toastSeq = 1
const num = (id) => Number(String(id || '').replace(/^\w+_/, '').split('|')[0]) || null

const LS_CONFLICTS = 'panta_sa_conflict_states'
const LS_SETTINGS = 'panta_sa_settings'

const DEFAULT_SETTINGS = {
  platformName: 'PANTA',
  supportEmail: 'support@panta.rw',
  defaultPlan: 'Standard',
  autoApproveSchools: false,
  maintenanceMode: false,
  sessionTimeout: 30,
  emailNotifications: true,
  smsNotifications: false,
  conflictDetection: true,
  weeklyDigest: true,
  twoFactorRequired: false
}

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export const saStore = createStore({
  ready: false,
  loading: false,
  offline: false,
  loadError: '',
  schools: [],
  users: [],
  subjects: [],
  departments: [],
  years: [],
  terms: [],
  classes: [],
  rooms: [],
  ttGroups: [],
  entries: [],
  activities: [],
  notifications: [],
  overview: null,
  serverConflicts: [],
  teacherNames: {}, // tch_<id> -> name
  conflictStates: readJson(LS_CONFLICTS, {}),
  settings: { ...DEFAULT_SETTINGS, ...readJson(LS_SETTINGS, {}) },
  demo: null, // offline demo db
  toasts: []
})

const patch = (partial) => saStore.setState(partial)
const state = () => saStore.getState()

export const saSelectors = {
  students: (s = state()) => s.users.filter((u) => u.role === 'student'),
  teachers: (s = state()) => s.users.filter((u) => u.role === 'teacher'),
  schoolAdmins: (s = state()) => s.users.filter((u) => u.role === 'admin'),
  dosUsers: (s = state()) => s.users.filter((u) => u.role === 'dos'),

  activitiesSorted: (s = state()) => [...s.activities].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  notificationsSorted: (s = state()) =>
    [...s.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  unreadCount: (s = state()) => s.notifications.filter((n) => !n.read).length,

  pendingSchools: (s = state()) => s.schools.filter((x) => x.status === 'pending'),
  pendingUsers: (s = state()) => s.users.filter((x) => x.status === 'pending'),
  pendingCount(s = state()) {
    return saSelectors.pendingSchools(s).length + saSelectors.pendingUsers(s).length
  },
  activeSchools: (s = state()) => s.schools.filter((x) => x.status === 'active'),
  publishedGroups: (s = state()) => s.ttGroups.filter((g) => g.status === 'published'),

  schoolById: (s = state()) => (id) => s.schools.find((x) => x.id === id),
  userById:
    (s = state()) =>
    (id) =>
      s.users.find((x) => x.id === id) || (s.teacherNames[id] ? { id, name: s.teacherNames[id] } : undefined),
  subjectById: (s = state()) => (id) => s.subjects.find((x) => x.id === id),
  classById: (s = state()) => (id) => s.classes.find((x) => x.id === id),
  roomById: (s = state()) => (id) => s.rooms.find((x) => x.id === id),

  schoolStats:
    (s = state()) =>
    (schoolId) => ({
      students: s.users.filter((u) => u.schoolId === schoolId && u.role === 'student').length,
      teachers: s.users.filter((u) => u.schoolId === schoolId && u.role === 'teacher').length,
      classes: s.classes.filter((c) => c.schoolId === schoolId).length,
      timetables: s.ttGroups.filter((g) => g.schoolId === schoolId).length,
      activeTimetables: s.ttGroups.filter((g) => g.schoolId === schoolId && g.status === 'published').length
    }),

  kpis(s = state()) {
    const o = s.overview
    const monthAgo = Date.now() - 30 * 86400000
    const inLast30 = (d) => d && new Date(d).getTime() >= monthAgo
    return {
      totalSchools: o?.totalSchools ?? s.schools.length,
      newSchools: s.schools.filter((x) => inLast30(x.createdAt)).length,
      activeSchools: o?.activeSchools ?? saSelectors.activeSchools(s).length,
      pendingApprovals: o ? o.pendingSchools + o.pendingUsers : saSelectors.pendingCount(s),
      totalUsers: o?.totalUsers ?? s.users.length,
      newUsers: s.users.filter((u) => inLast30(u.createdAt)).length,
      totalTeachers: o?.teachers ?? saSelectors.teachers(s).length,
      totalStudents: o?.students ?? saSelectors.students(s).length,
      activeTimetables: o?.publishedTimetables ?? saSelectors.publishedGroups(s).length,
      conflicts: o?.openConflicts ?? saSelectors.openConflicts(s).length
    }
  },

  conflicts(s = state()) {
    if (s.offline) return saActions.demoConflicts(s)
    return s.serverConflicts
      .map((c) => ({ ...c, state: s.conflictStates[c.key] || 'open' }))
      .sort((a, b) => (a.state === 'open' ? -1 : 1) - (b.state === 'open' ? -1 : 1))
  },

  openConflicts(s = state()) {
    return saSelectors.conflicts(s).filter((c) => c.state === 'open')
  },

  // Owner-scope search: schools and user accounts only (academic data
  // belongs to the Director of Studies console).
  searchIndex(s = state()) {
    const schools = s.schools.map((school) => ({
      kind: 'School',
      label: school.name,
      sub: `${school.code} · ${school.location}`,
      link: `/super-admin/schools/${school.id}`
    }))
    const people = s.users
      .filter((u) => u.role !== 'student')
      .map((u) => ({
        kind: 'User',
        label: u.name,
        sub: `${u.role.toUpperCase()} · ${u.email}`,
        link: `/super-admin/users?q=${encodeURIComponent(u.name)}`
      }))
    return [...schools, ...people]
  }
}

export const saActions = {
  // ---- bootstrap -----------------------------------------------------------
  async bootstrap() {
    const s = state()
    if (s.ready || s.loading) return
    patch({ loading: true, loadError: '' })

    try {
      const [
        overview,
        schools,
        users,
        subjects,
        departments,
        years,
        terms,
        classes,
        rooms,
        groups,
        conflicts,
        activity,
        notifications
      ] = await Promise.all([
        saApi.overview(),
        saApi.listSchools(),
        saApi.listUsers(),
        saApi.listSubjects(),
        saApi.listDepartments(),
        saApi.listYears(),
        saApi.listTerms(),
        saApi.listClasses(),
        saApi.listRooms(),
        saApi.listTimetables(),
        saApi.listConflicts(),
        saApi.listActivity(),
        saApi.listNotifications().catch(() => [])
      ])

      patch({
        overview,
        schools,
        users: users.items,
        subjects,
        departments,
        years,
        terms,
        classes,
        rooms,
        ttGroups: groups,
        serverConflicts: conflicts,
        activities: activity.items,
        notifications
      })

      // Load entries for every timetable group (grids, reports, analytics).
      const entryLists = await Promise.all(groups.map((g) => saApi.listEntries(g).catch(() => [])))
      patch({ entries: entryLists.flat() })

      saActions.rebuildTeacherNames()
      patch({ offline: false })
    } catch (error) {
      // Offline demo fallback — explicit, visible, and only when the API is down.
      const demo = loadDb()
      patch({
        offline: true,
        demo,
        schools: demo.schools,
        users: demo.users,
        subjects: demo.subjects,
        departments: demo.departments,
        years: demo.years,
        terms: demo.terms,
        classes: demo.classes,
        rooms: demo.rooms,
        ttGroups: demo.ttGroups,
        entries: demo.entries,
        activities: demo.activities,
        notifications: demo.notifications,
        conflictStates: demo.conflictStates || {},
        overview: null,
        loadError:
          'Backend unreachable — showing the offline demo dataset. Changes are stored locally only.'
      })
      saActions.toast('error', state().loadError, 'Offline mode')
    } finally {
      patch({ ready: true, loading: false })
    }
  },

  rebuildTeacherNames() {
    const map = {}
    state().users.forEach((u) => {
      if (u.teacherId) map[`tch_${u.teacherId}`] = u.name
    })
    state().classes.forEach((c) => {
      if (c.teacherId && c.teacherName !== '—') map[c.teacherId] = c.teacherName
    })
    patch({ teacherNames: map })
  },

  // Offline conflict computation (demo mode only — the server computes in normal mode)
  demoConflicts(s = state()) {
    if (!s.offline) return []
    const out = []
    const published = s.entries.filter((e) => e.status === 'published')
    const buckets = new Map()
    published.forEach((e) => {
      const key = `${e.schoolId}|${e.day}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(e)
    })
    buckets.forEach((list) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]
          const b = list[j]
          if (!overlaps(a.start, a.end, b.start, b.end)) continue
          const push = (type) => {
            const key = `${type}:${[a.id, b.id].sort().join(':')}`
            if (out.some((c) => c.key === key)) return
            const school = saSelectors.schoolById(s)(a.schoolId)
            const teacher = saSelectors.userById(s)(a.teacherId)
            const clsA = saSelectors.classById(s)(a.classId)
            const clsB = saSelectors.classById(s)(b.classId)
            const subA = saSelectors.subjectById(s)(a.subjectId)
            const room = saSelectors.roomById(s)(a.roomId)
            const detail =
              type === 'teacher'
                ? `${teacher?.name || 'A teacher'} is assigned to ${clsA?.name} ${subA?.name} and ${clsB?.name} at ${a.start} on ${DAYS[a.day]}.`
                : type === 'room'
                  ? `${room?.name || 'A room'} is booked for ${clsA?.name} and ${clsB?.name} at ${a.start} on ${DAYS[a.day]}.`
                  : `${clsA?.name} has two subjects scheduled at ${a.start} on ${DAYS[a.day]}.`
            out.push({
              key,
              type,
              title: `${type[0].toUpperCase() + type.slice(1)} conflict`,
              detail,
              day: a.day,
              start: a.start,
              end: a.end,
              schoolId: a.schoolId,
              schoolName: school?.name || 'Unknown school',
              entryIds: [a.id, b.id],
              state: s.conflictStates[key] || 'open'
            })
          }
          if (a.teacherId === b.teacherId && a.classId !== b.classId) push('teacher')
          else if (a.roomId === b.roomId && a.classId !== b.classId) push('room')
          else if (a.classId === b.classId && a.subjectId !== b.subjectId) push('class')
        }
      }
    })
    return out.sort((a, b) => (a.state === 'open' ? -1 : 1) - (b.state === 'open' ? -1 : 1))
  },

  saveConflictStates() {
    const s = state()
    localStorage.setItem(LS_CONFLICTS, JSON.stringify(s.conflictStates))
    if (s.offline && s.demo) {
      patch({ demo: { ...s.demo, conflictStates: s.conflictStates } })
      persistDb(state().demo)
    }
  },

  // ---- feedback -------------------------------------------------------------
  toast(type, message, title) {
    const id = toastSeq++
    patch((current) => ({ toasts: [...current.toasts, { id, type, message, title }] }))
    setTimeout(() => {
      patch((current) => ({ toasts: current.toasts.filter((t) => t.id !== id) }))
    }, 4200)
  },

  success(message, title) {
    saActions.toast('success', message, title)
  },

  error(message, title) {
    saActions.toast('error', message, title)
  },

  apiError(error, fallback = 'Action failed') {
    saActions.error(
      error?.response?.data?.message || error?.response?.data?.errors?.[0]?.msg || error?.message || fallback,
      'Error'
    )
  },

  logActivity(action, entity, entityName, status = 'success') {
    // Server logs every mutation; this local entry keeps the feed live in offline mode.
    patch((s) => ({
      activities: [
        ...s.activities,
        {
          id: uid('act'),
          actor: 'Super Admin',
          actorRole: 'super_admin',
          action,
          entity,
          entityName,
          status,
          createdAt: new Date().toISOString()
        }
      ]
    }))
  },

  notify(type, title, message, link = '/super-admin/dashboard') {
    patch((s) => ({
      notifications: [
        ...s.notifications,
        { id: uid('ntf'), type, title, message, link, read: false, createdAt: new Date().toISOString() }
      ]
    }))
  },

  async refreshSchools() {
    patch({ schools: await saApi.listSchools() })
  },
  async refreshUsers() {
    patch({ users: (await saApi.listUsers()).items })
    saActions.rebuildTeacherNames()
  },
  async refreshConflicts() {
    patch({ serverConflicts: await saApi.listConflicts() })
  },
  async refreshActivity() {
    patch({ activities: (await saApi.listActivity()).items })
  },
  async refreshOverview() {
    patch({ overview: await saApi.overview() })
  },
  async refreshTimetables() {
    patch({ ttGroups: await saApi.listTimetables() })
  },

  // ---- Schools ----------------------------------------------------------------
  async addSchool(data) {
    if (state().offline) return saActions.demoAddSchool(data)
    const created = await saApi.createSchool(data)
    await Promise.all([saActions.refreshSchools(), saActions.refreshOverview(), saActions.refreshActivity()])
    saActions.notify(
      'school',
      'New school added',
      `${created.name} was added and is pending approval.`,
      `/super-admin/schools/${created.id}`
    )
    return created
  },

  async updateSchool(id, data) {
    if (state().offline) return saActions.demoUpdateSchool(id, data)
    const school = saSelectors.schoolById()(id)
    await saApi.updateSchool(school, data)
    await saActions.refreshSchools()
  },

  async approveSchool(id) {
    if (state().offline) return saActions.demoSchoolStatus(id, 'active', 'Approved school')
    await saApi.approveSchool(saSelectors.schoolById()(id))
    await Promise.all([saActions.refreshSchools(), saActions.refreshOverview(), saActions.refreshActivity()])
  },

  async rejectSchool(id, reason) {
    if (state().offline) return saActions.demoSchoolStatus(id, 'rejected', 'Rejected school application', reason)
    await saApi.rejectSchool(saSelectors.schoolById()(id), reason)
    await Promise.all([saActions.refreshSchools(), saActions.refreshOverview(), saActions.refreshActivity()])
  },

  async suspendSchool(id) {
    if (state().offline) return saActions.demoSchoolStatus(id, 'suspended', 'Suspended school')
    await saApi.suspendSchool(saSelectors.schoolById()(id))
    await Promise.all([saActions.refreshSchools(), saActions.refreshOverview(), saActions.refreshActivity()])
  },

  async activateSchool(id) {
    if (state().offline) return saActions.demoSchoolStatus(id, 'active', 'Activated school')
    await saApi.activateSchool(saSelectors.schoolById()(id))
    await Promise.all([saActions.refreshSchools(), saActions.refreshOverview(), saActions.refreshActivity()])
  },

  async deleteSchool(id) {
    if (state().offline) {
      const s = state()
      const school = saSelectors.schoolById(s)(id)
      patch({ schools: s.schools.filter((x) => x.id !== id) })
      saActions.logActivity('Deleted school', 'school', school?.name, 'danger')
      saActions.persistDemo()
      return undefined
    }
    await saApi.deleteSchool(saSelectors.schoolById()(id))
    await Promise.all([saActions.refreshSchools(), saActions.refreshOverview(), saActions.refreshActivity()])
  },

  // ---- Users ---------------------------------------------------------------------
  async addUser(data) {
    if (state().offline) {
      const user = {
        id: uid('usr'),
        status: 'active',
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        ...data
      }
      patch((s) => ({ users: [...s.users, user] }))
      saActions.logActivity('Added user', 'user', `${user.name} (${user.role})`, 'info')
      saActions.persistDemo()
      return user
    }
    const created = await saApi.createUser({
      full_name: data.name,
      email: data.email,
      role: data.role,
      school_id: num(data.schoolId),
      phone: data.phone,
      status: data.status
    })
    await Promise.all([saActions.refreshUsers(), saActions.refreshOverview(), saActions.refreshActivity()])
    return created
  },

  async updateUser(id, data) {
    if (state().offline) {
      patch((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, ...data } : x)) }))
      saActions.persistDemo()
      return undefined
    }
    const user = state().users.find((x) => x.id === id)
    await saApi.updateUser(user, {
      full_name: data.name,
      email: data.email,
      role: data.role,
      school_id: num(data.schoolId),
      phone: data.phone,
      status: data.status
    })
    await saActions.refreshUsers()
  },

  async setUserStatus(id, status) {
    const map = { active: 'active', suspended: 'suspended', pending: 'pending', rejected: 'rejected' }
    if (state().offline) {
      patch((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, status } : x)) }))
      saActions.persistDemo()
      return undefined
    }
    const user = state().users.find((x) => x.id === id)
    await saApi.setUserStatus(user, map[status] || status)
    await Promise.all([saActions.refreshUsers(), saActions.refreshActivity()])
  },

  async deleteUser(id) {
    if (state().offline) {
      patch((s) => ({ users: s.users.filter((x) => x.id !== id) }))
      saActions.persistDemo()
      return undefined
    }
    await saApi.deleteUser(state().users.find((x) => x.id === id))
    await Promise.all([saActions.refreshUsers(), saActions.refreshOverview(), saActions.refreshActivity()])
  },

  async resetUserPassword(id) {
    const user = state().users.find((x) => x.id === id)
    if (state().offline) return { message: `Password reset link sent to ${user?.email}.` }
    return saApi.resetUserPassword(user)
  },

  // ---- Academic CRUD (years, terms, classes, subjects, departments) -----------------
  async addItem(collection, data) {
    const created = await saActions.persistItem('add', collection, null, data)
    saActions.logActivity(`Added ${collection.replace(/s$/, '')}`, collection.replace(/s$/, ''), data.name, 'info')
    return created
  },

  async updateItem(collection, id, data) {
    await saActions.persistItem('update', collection, id, data)
    saActions.logActivity(`Updated ${collection.replace(/s$/, '')}`, collection.replace(/s$/, ''), data.name, 'info')
  },

  async removeItem(collection, id) {
    const item = state()[collection].find((x) => x.id === id)
    await saActions.persistItem('remove', collection, id, {})
    if (item) {
      saActions.logActivity(`Deleted ${collection.replace(/s$/, '')}`, collection.replace(/s$/, ''), item.name, 'danger')
    }
  },

  async persistItem(op, collection, id, data) {
    const list = state()[collection]

    if (state().offline) {
      if (op === 'add') {
        const item = {
          id: uid(collection.slice(0, 3)),
          status: 'active',
          createdAt: new Date().toISOString(),
          ...data
        }
        patch((s) => ({ [collection]: [...s[collection], item] }))
      }
      if (op === 'update') {
        patch((s) => ({
          [collection]: s[collection].map((x) => (x.id === id ? { ...x, ...data } : x))
        }))
      }
      if (op === 'remove') {
        patch((s) => ({ [collection]: s[collection].filter((x) => x.id !== id) }))
      }
      saActions.persistDemo()
      return state()[collection].find((x) => x.id === id)
    }

    try {
      if (collection === 'years') {
        const body = { name: data.name, start_date: data.startDate, end_date: data.endDate, status: data.status }
        const item =
          op === 'add'
            ? await saApi.saveItem('academic_year', body)
            : op === 'update'
              ? await saApi.updateItem('academic_year', num(id), body)
              : null
        if (op === 'remove') await saApi.deleteItem('academic_year', num(id))
        patch({ years: await saApi.listYears() })
        return item
      }
      if (collection === 'terms') {
        const body = {
          name: data.name,
          year_id: num(data.yearId),
          start_date: data.startDate,
          end_date: data.endDate,
          status: data.status
        }
        const item =
          op === 'add'
            ? await saApi.saveItem('term', body)
            : op === 'update'
              ? await saApi.updateItem('term', num(id), body)
              : null
        if (op === 'remove') await saApi.deleteItem('term', num(id))
        patch({ terms: await saApi.listTerms() })
        return item
      }
      if (collection === 'departments') {
        const body = { name: data.name, head: data.head, status: data.status }
        const item =
          op === 'add'
            ? await saApi.saveItem('department', body)
            : op === 'update'
              ? await saApi.updateItem('department', num(id), body)
              : null
        if (op === 'remove') await saApi.deleteItem('department', num(id))
        patch({ departments: await saApi.listDepartments() })
        return item
      }
      if (collection === 'subjects') {
        const body = {
          module_name: data.name,
          department:
            state().departments.find((d) => d.id === data.departmentId)?.name || data.department || 'General',
          hours_per_year: data.hoursPerYear || null
        }
        const item =
          op === 'add'
            ? await saApi.createSubject(body)
            : op === 'update'
              ? await saApi.updateSubject(state().subjects.find((s) => s.id === id), body)
              : null
        if (op === 'remove') await saApi.deleteSubject(state().subjects.find((s) => s.id === id))
        patch({ subjects: await saApi.listSubjects() })
        return item
      }
      if (collection === 'classes') {
        const body = {
          class_name: data.name,
          level: data.level,
          school_id: num(data.schoolId),
          academic_year: data.academicYear || state().years.find((y) => y.status === 'active')?.name || null
        }
        const item =
          op === 'add'
            ? await saApi.createClass(body)
            : op === 'update'
              ? await saApi.updateClass(state().classes.find((c) => c.id === id), body)
              : null
        if (op === 'remove') await saApi.deleteClass(state().classes.find((c) => c.id === id))
        patch({ classes: await saApi.listClasses() })
        saActions.rebuildTeacherNames()
        return item
      }
    } catch (error) {
      saActions.apiError(error)
      throw error
    }

    return null
  },

  // ---- Timetables --------------------------------------------------------------------
  async loadEntries(group) {
    if (state().offline) return
    const entries = await saApi.listEntries(group)
    patch((s) => ({ entries: [...s.entries.filter((e) => e.groupId !== group.id), ...entries] }))

    // keep teacher directory fresh
    const teacherNames = { ...state().teacherNames }
    entries.forEach((e) => {
      if (e.teacherId && e.teacherName !== '—') teacherNames[e.teacherId] = e.teacherName
    })
    patch({ teacherNames })
  },

  async setGroupStatus(groupId, status) {
    const group = state().ttGroups.find((x) => x.id === groupId)
    if (!group) return

    if (state().offline) {
      patch((s) => ({
        ttGroups: s.ttGroups.map((g) => (g.id === groupId ? { ...g, status } : g)),
        entries: s.entries.map((e) => (e.groupId === groupId ? { ...e, status } : e))
      }))
      saActions.persistDemo()
      return
    }

    await saApi.setGroupStatus(group, status)
    await Promise.all([
      saActions.refreshTimetables(),
      saActions.refreshConflicts(),
      saActions.refreshActivity(),
      saActions.refreshOverview()
    ])
  },

  async deleteGroup(groupId) {
    const group = state().ttGroups.find((x) => x.id === groupId)

    if (state().offline) {
      patch((s) => ({
        ttGroups: s.ttGroups.filter((x) => x.id !== groupId),
        entries: s.entries.filter((e) => e.groupId !== groupId)
      }))
      saActions.persistDemo()
      return
    }

    await saApi.deleteGroup(group)
    await saActions.refreshTimetables()
  },

  async generateTimetable({ schoolId, termId, periodsPerClass = 24 }) {
    const s = state()
    const school = saSelectors.schoolById(s)(schoolId)
    const term = s.terms.find((t) => t.id === termId)
    if (!school || !term) return null

    if (s.offline) return saActions.demoGenerate({ school, term, periodsPerClass })

    const year = s.years.find((y) => y.id === term.yearId)
    const result = await saApi.generateTimetable({
      school_id: school.schoolId,
      academic_year: year?.name || term.year,
      term: term.name,
      periods_per_class: periodsPerClass
    })
    await Promise.all([saActions.refreshTimetables(), saActions.refreshActivity(), saActions.refreshOverview()])
    const group = state().ttGroups.find(
      (x) => x.id === groupKey(school.schoolId, year?.name, term.name) && x.status === 'draft'
    )
    return group || result.group
  },

  setConflictState(key, conflictState) {
    patch((s) => ({ conflictStates: { ...s.conflictStates, [key]: conflictState } }))
    saActions.saveConflictStates()
    if (conflictState === 'resolved') saActions.logActivity('Resolved timetable conflict', 'conflict', key)
  },

  // ---- Notifications ---------------------------------------------------------------------
  async markRead(id) {
    const notification = state().notifications.find((x) => x.id === id)
    if (notification) {
      patch((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      }))
    }
    if (!state().offline && notification?.notificationId) {
      try {
        await saApi.markNotificationRead(notification)
      } catch {
        /* visual state already updated */
      }
    }
  },

  async markAllRead() {
    patch((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
    if (!state().offline) {
      try {
        await saApi.markAllNotificationsRead()
      } catch {
        /* noop */
      }
    }
  },

  async deleteNotification(id) {
    const notification = state().notifications.find((x) => x.id === id)
    patch((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) }))
    if (!state().offline && notification?.notificationId) {
      try {
        await saApi.deleteNotification(notification)
      } catch {
        /* noop */
      }
    }
  },

  async clearReadNotifications() {
    const s = state()
    const readOnes = s.notifications.filter((x) => x.read)
    patch({ notifications: s.notifications.filter((x) => !x.read) })
    if (!s.offline) {
      await Promise.all(
        readOnes
          .filter((n) => n.notificationId)
          .map((n) => saApi.deleteNotification(n).catch(() => {}))
      )
    }
  },

  // ---- Settings / maintenance -------------------------------------------------------------
  updateSettings(settingsPatch) {
    const settings = { ...state().settings, ...settingsPatch }
    patch({ settings })
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
    saActions.logActivity('Updated platform settings', 'settings', 'Platform configuration', 'info')
  },

  persistDemo() {
    const s = state()
    if (!s.offline || !s.demo) return
    const demo = {
      ...s.demo,
      schools: s.schools,
      users: s.users,
      subjects: s.subjects,
      departments: s.departments,
      years: s.years,
      terms: s.terms,
      classes: s.classes,
      rooms: s.rooms,
      ttGroups: s.ttGroups,
      entries: s.entries
    }
    patch({ demo })
    persistDb(demo)
  },

  resetDemoData() {
    if (state().offline) {
      const demo = resetDb()
      patch({
        demo,
        schools: demo.schools,
        users: demo.users,
        subjects: demo.subjects,
        departments: demo.departments,
        years: demo.years,
        terms: demo.terms,
        classes: demo.classes,
        rooms: demo.rooms,
        ttGroups: demo.ttGroups,
        entries: demo.entries
      })
      saActions.success('Offline demo data has been reset.', 'Data reset')
    } else {
      saActions.error(
        'Demo reset only applies to the offline dataset. Live data is managed through the console.',
        'Live mode'
      )
    }
  },

  // ---- Offline demo helpers (only run when backend is unreachable) --------------------------
  demoAddSchool(data) {
    const school = {
      id: uid('sch'),
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      rejectReason: null,
      ...data
    }
    patch((s) => ({ schools: [...s.schools, school] }))
    saActions.logActivity('Added school', 'school', school.name, 'info')
    saActions.persistDemo()
    return school
  },

  demoUpdateSchool(id, data) {
    const school = saSelectors.schoolById()(id)
    if (!school) return
    patch((s) => ({
      schools: s.schools.map((x) =>
        x.id === id ? { ...x, ...data, lastActivityAt: new Date().toISOString() } : x
      )
    }))
    saActions.persistDemo()
  },

  demoSchoolStatus(id, status, action, reason = null) {
    const school = saSelectors.schoolById()(id)
    if (!school) return
    patch((s) => ({
      schools: s.schools.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              rejectReason: reason || x.rejectReason,
              lastActivityAt: new Date().toISOString()
            }
          : x
      )
    }))
    saActions.logActivity(
      action,
      'school',
      school.name,
      status === 'rejected' || status === 'suspended' ? 'danger' : 'success'
    )
    saActions.persistDemo()
  },

  demoGenerate({ school, term, periodsPerClass }) {
    const s = state()
    const teachers = s.users.filter(
      (u) => u.schoolId === school.id && u.role === 'teacher' && u.status === 'active'
    )
    const classes = s.classes.filter((c) => c.schoolId === school.id)
    const rooms = s.rooms.filter((r) => r.schoolId === school.id)
    if (!teachers.length || !classes.length || !rooms.length) return null

    const year = s.years.find((y) => y.id === term.yearId)
    const group = {
      id: uid('tt'),
      name: `${term.name} · ${year?.name || ''}`,
      schoolId: school.id,
      termId: term.id,
      yearId: term.yearId,
      status: 'draft',
      createdAt: new Date().toISOString()
    }
    patch((current) => ({ ttGroups: [...current.ttGroups, group] }))

    const busyTeacher = new Set()
    const busyRoom = new Set()
    const newEntries = []

    classes.forEach((cls, ci) => {
      let placed = 0
      for (let slotIdx = 0; slotIdx < DAYS.length * SLOTS.length && placed < periodsPerClass; slotIdx++) {
        const day = slotIdx % DAYS.length
        const slot = (slotIdx + ci) % SLOTS.length
        const key = `${day}-${slot}`
        const teacher = teachers[(slotIdx + ci * 3) % teachers.length]
        const room = rooms[(slotIdx + ci) % rooms.length]
        if (busyTeacher.has(`${teacher.id}-${key}`) || busyRoom.has(`${room.id}-${key}`)) continue
        busyTeacher.add(`${teacher.id}-${key}`)
        busyRoom.add(`${room.id}-${key}`)
        newEntries.push({
          id: uid('en'),
          groupId: group.id,
          schoolId: school.id,
          classId: cls.id,
          teacherId: teacher.id,
          subjectId: teacher.subjectIds?.[0],
          roomId: room.id,
          day,
          start: SLOTS[slot][0],
          end: SLOTS[slot][1],
          status: 'draft'
        })
        placed++
      }
    })

    patch((current) => ({ entries: [...current.entries, ...newEntries] }))
    saActions.persistDemo()
    return group
  }
}
