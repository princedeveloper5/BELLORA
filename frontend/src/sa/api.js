// ============================================================================
// PANTA Super Admin — backend service layer.
// All calls go through the shared axios instance (JWT attached automatically)
// and normalize MySQL rows into the shapes the views consume.
//
// `silent` opts every console request out of the LEGACY global notification
// interceptor (stores/api.js) — the consoles render their own toasts, so we
// never show duplicate success/error banners.
// ============================================================================

import api from '@/lib/api'

const silent = (config = {}) => ({ showGlobalNotification: false, showGlobalLoader: false, ...config })

// ---- Status maps ------------------------------------------------------------
const SCHOOL_STATUS = {
  active: 'active', pending_approval: 'pending', rejected: 'rejected',
  suspended: 'suspended', expired: 'suspended', deactivated: 'suspended'
}
const USER_STATUS = {
  active: 'active', pending: 'pending', suspended: 'suspended',
  disabled: 'suspended', rejected: 'rejected'
}

// ---- Normalizers ------------------------------------------------------------
export const normSchool = (s) => ({
  id: `sch_${s.school_id}`, schoolId: s.school_id,
  name: s.school_name, code: s.school_code || `SCH${s.school_id}`,
  location: s.district || s.province || '—', province: s.province, district: s.district, sector: s.sector,
  address: s.school_address, leader: s.dos_name || '—',
  email: s.school_email, phone: s.phone,
  status: SCHOOL_STATUS[s.status] || 'pending', rawStatus: s.status,
  plan: s.subscription_plan || 'Standard', subscriptionStatus: s.subscription_status,
  createdAt: s.created_at, lastActivityAt: s.updated_at, rejectReason: s.rejection_reason || null
})

export const normUser = (u) => ({
  id: `usr_${u.id}`, userId: u.id,
  name: u.full_name || u.username || u.email, email: u.email, role: u.role,
  schoolId: u.school_id ? `sch_${u.school_id}` : '', schoolName: u.school_name || '',
  status: USER_STATUS[u.status] || 'pending', rawStatus: u.status,
  phone: u.phone || '', lastLoginAt: u.last_login, createdAt: u.created_at,
  classId: u.class_id ? `cls_${u.class_id}` : null, teacherId: u.teacher_id || null
})

export const normSubject = (m) => ({
  id: `sub_${m.module_id}`, moduleId: m.module_id,
  name: m.module_name, code: (m.module_name || '??').split(/\s+/).map((w) => w[0]).join('').slice(0, 5).toUpperCase(),
  department: m.department || 'General', schoolId: m.school_id ? `sch_${m.school_id}` : '',
  status: 'active', createdAt: m.created_at
})

export const normDepartment = (d) => ({
  id: `dep_${d.department_id}`, departmentId: d.department_id,
  name: d.name, head: d.head || '—', status: d.status, createdAt: d.created_at
})

export const normYear = (y) => ({
  id: `yr_${y.year_id}`, yearId: y.year_id, name: y.name,
  startDate: y.start_date, endDate: y.end_date, status: y.status, createdAt: y.created_at
})

export const normTerm = (t) => ({
  id: `tm_${t.term_id}`, termId: t.term_id, name: t.name, yearId: `yr_${t.year_id}`,
  startDate: t.start_date, endDate: t.end_date, status: t.status, createdAt: t.created_at
})

export const normClass = (c) => ({
  id: `cls_${c.class_id}`, classId: c.class_id, name: c.class_name, level: c.level || '—',
  schoolId: `sch_${c.school_id}`, schoolName: c.school_name || '',
  teacherId: c.class_teacher_id ? `tch_${c.class_teacher_id}` : null,
  teacherName: c.class_teacher_name || '—',
  students: Number(c.student_count || 0), academicYear: c.academic_year, createdAt: c.created_at
})

export const normRoom = (r) => ({
  id: `rm_${r.room_id}`, roomId: r.room_id, name: r.room_name, type: r.room_type || 'Classroom',
  capacity: r.capacity, schoolId: `sch_${r.school_id}`
})

export const groupKey = (schoolId, year, term) => `ttg_${schoolId}|${year}|${term}`

export const normGroup = (g) => ({
  id: groupKey(g.school_id, g.academic_year, g.term),
  schoolId: `sch_${g.school_id}`, rawSchoolId: g.school_id,
  year: g.academic_year, term: g.term, name: `${g.term} · ${g.academic_year}`,
  schoolName: g.school_name, status: g.status,
  periods: Number(g.periods || 0), classCount: Number(g.classes || 0), createdAt: g.created_at
})

const DAY_INDEX = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }

export const normEntry = (e) => ({
  id: `en_${e.timetable_id}`, entryId: e.timetable_id,
  groupId: groupKey(e.school_id, e.academic_year, e.term),
  schoolId: `sch_${e.school_id}`, classId: `cls_${e.class_id}`,
  teacherId: e.teacher_id ? `tch_${e.teacher_id}` : null,
  subjectId: e.module_id ? `sub_${e.module_id}` : null,
  roomId: e.room_id ? `rm_${e.room_id}` : null,
  teacherName: e.teacher_name || '—', subjectName: e.module_name || '—',
  className: e.class_name || '—', roomName: e.room_name || '—',
  day: DAY_INDEX[e.day_of_week] ?? 0, start: e.start_time, end: e.end_time,
  status: e.status, assignmentId: e.assignment_id
})

export const normActivity = (a) => ({
  id: `act_${a.activity_id}`, actor: a.actor || 'System', actorRole: a.actor_role || 'system',
  action: a.action, entity: a.entity_type || 'record', entityName: a.message || '',
  status: /approv|activat|creat|add|publish|success/i.test(a.action) ? 'success'
    : /reject|suspend|delet|disable|conflict/i.test(a.action) ? 'danger'
    : /warn|expir/i.test(a.action) ? 'warning' : 'info',
  createdAt: a.created_at
})

export const normNotification = (n) => ({
  id: `ntf_${n.notification_id ?? n.id}`, notificationId: n.notification_id ?? n.id,
  type: n.type || 'system', title: n.title, message: n.message,
  link: n.path || '/super-admin/dashboard', read: !!n.read_at, createdAt: n.created_at
})

// ---- API surface ------------------------------------------------------------
export const saApi = {
  overview: () => api.get('/sa/overview', silent()).then((r) => r.data),
  // Schools (existing platform routes)
  listSchools: () => api.get('/schools', silent({ params: { limit: 500 } })).then((r) => {
    // The platform schools query can fan-out on DOS joins — de-duplicate by id.
    const seen = new Set()
    return (r.data.schools || r.data.items || [])
      .filter((s) => !seen.has(s.school_id) && seen.add(s.school_id))
      .map(normSchool)
  }),
  createSchool: (data) => api.post('/schools', {
    school_name: data.name, school_code: data.code, registration_number: data.code,
    school_email: data.email, phone: data.phone,
    district: data.location, province: data.province || data.location,
    school_address: data.address || data.location, subscription_plan: data.plan,
    status: 'pending_approval'
  }, silent()).then((r) => normSchool(r.data.school)),
  updateSchool: (school, data) => api.put(`/sa/schools/${school.schoolId}`, {
    school_name: data.name, school_code: data.code, school_email: data.email, phone: data.phone,
    district: data.location, subscription_plan: data.plan
  }, silent()).then((r) => normSchool(r.data.school)),
  approveSchool: (school) => api.put(`/schools/${school.schoolId}/approve`, {}, silent()).then((r) => r.data),
  rejectSchool: (school, reason) => api.put(`/schools/${school.schoolId}/reject`, { reason }, silent()).then((r) => r.data),
  suspendSchool: (school) => api.put(`/schools/${school.schoolId}/suspend`, {}, silent()).then((r) => r.data),
  activateSchool: (school) => api.put(`/schools/${school.schoolId}/activate`, {}, silent()).then((r) => r.data),
  deleteSchool: (school) => api.delete(`/schools/${school.schoolId}`, silent()).then((r) => r.data),
  // Users
  listUsers: (params = {}) => api.get('/sa/users', silent({ params: { limit: 1000, ...params } })).then((r) => ({ ...r.data, items: r.data.items.map(normUser) })),
  createUser: (data) => api.post('/sa/users', data, silent()).then((r) => normUser(r.data.user)),
  updateUser: (user, data) => api.put(`/sa/users/${user.userId}`, data, silent()).then((r) => normUser(r.data.user)),
  setUserStatus: (user, status) => api.put(`/sa/users/${user.userId}/status`, { status }, silent()).then((r) => r.data),
  deleteUser: (user) => api.delete(`/sa/users/${user.userId}`, silent()).then((r) => r.data),
  resetUserPassword: (user) => api.post(`/sa/users/${user.userId}/reset-password`, {}, silent()).then((r) => r.data),
  // Academic
  listYears: () => api.get('/sa/academic_year', silent()).then((r) => r.data.items.map(normYear)),
  listTerms: () => api.get('/sa/term', silent()).then((r) => r.data.items.map(normTerm)),
  listDepartments: () => api.get('/sa/department', silent()).then((r) => r.data.items.map(normDepartment)),
  listSubjects: () => api.get('/sa/subjects', silent()).then((r) => r.data.items.map(normSubject)),
  listClasses: () => api.get('/sa/classes', silent()).then((r) => r.data.items.map(normClass)),
  listRooms: () => api.get('/sa/rooms', silent()).then((r) => r.data.items.map(normRoom)),
  saveItem: (kind, body) => api.post(`/sa/${kind}`, body, silent()).then((r) => r.data.item),
  updateItem: (kind, id, body) => api.put(`/sa/${kind}/${id}`, body, silent()).then((r) => r.data.item),
  deleteItem: (kind, id) => api.delete(`/sa/${kind}/${id}`, silent()).then((r) => r.data),
  createSubject: (body) => api.post('/sa/subjects', body, silent()).then((r) => normSubject(r.data.item)),
  updateSubject: (subject, body) => api.put(`/sa/subjects/${subject.moduleId}`, body, silent()).then((r) => normSubject(r.data.item)),
  deleteSubject: (subject) => api.delete(`/sa/subjects/${subject.moduleId}`, silent()).then((r) => r.data),
  createClass: (body) => api.post('/sa/classes', body, silent()).then((r) => normClass({ ...r.data.item, student_count: 0 })),
  updateClass: (cls, body) => api.put(`/sa/classes/${cls.classId}`, body, silent()).then((r) => r.data),
  deleteClass: (cls) => api.delete(`/sa/classes/${cls.classId}`, silent()).then((r) => r.data),
  // Timetables
  listTimetables: () => api.get('/sa/timetables', silent()).then((r) => r.data.items.map(normGroup)),
  listEntries: (group) => {
    // Skip legacy rows without a year/term instead of firing an invalid request.
    if (!group?.rawSchoolId || !group?.year || !group?.term) return Promise.resolve([])
    return api.get('/sa/timetables/entries', silent({
      params: { school_id: group.rawSchoolId, academic_year: group.year, term: group.term }
    })).then((r) => r.data.items.map(normEntry))
  },
  setGroupStatus: (group, status) => api.put('/sa/timetables/status', {
    school_id: group.rawSchoolId, academic_year: group.year, term: group.term, status
  }, silent()).then((r) => r.data),
  deleteGroup: (group) => api.delete('/sa/timetables/group', silent({
    data: { school_id: group.rawSchoolId, academic_year: group.year, term: group.term }
  })).then((r) => r.data),
  listConflicts: () => api.get('/sa/timetable-conflicts', silent()).then((r) => r.data.items),
  listAssignments: (schoolId) => api.get('/sa/assignments', silent({ params: schoolId ? { school_id: schoolId } : {} })).then((r) => r.data.items),
  generateTimetable: (body) => api.post('/sa/timetables/generate', body, silent()).then((r) => r.data),
  // Activity
  listActivity: (params = {}) => api.get('/sa/activity', silent({ params: { limit: 300, ...params } })).then((r) => ({ ...r.data, items: r.data.items.map(normActivity) })),
  // Notifications (existing platform routes)
  listNotifications: () => api.get('/notifications', silent()).then((r) => (r.data.notifications || r.data.items || r.data || []).map(normNotification)),
  markNotificationRead: (n) => api.put(`/notifications/${n.notificationId}/read`, {}, silent()).then((r) => r.data),
  markAllNotificationsRead: () => api.put('/notifications/read/all', {}, silent()).then((r) => r.data),
  deleteNotification: (n) => api.delete(`/notifications/${n.notificationId}`, silent()).then((r) => r.data)
}
