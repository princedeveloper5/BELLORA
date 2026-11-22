// ============================================================================
// BELLORA Super Admin — local data layer.
//
// This module builds a deterministic, relationally-consistent dataset
// (Schools -> Users/Teachers/Students/Classes/Rooms -> Timetables) and
// persists it to localStorage so every mutation in the UI is real and
// survives reloads.
//
// API MIGRATION: replace `loadDb`/`persistDb` with HTTP calls to the real
// backend (see client/src/stores/api.js). Every store action in store.js is
// a 1:1 candidate for a REST endpoint (POST /schools, PATCH /schools/:id,
// POST /schools/:id/approve, ...). No component talks to localStorage
// directly — everything goes through the Pinia store, so swapping the
// persistence layer does not touch the UI.
// ============================================================================

import { mulberry32, DAYS, SLOTS } from './format'

const DB_KEY = 'panta_sa_db_v1'

const FIRST = ['Jean', 'Aline', 'Eric', 'Diane', 'Patrick', 'Grace', 'Samuel', 'Olive', 'David', 'Chantal', 'Emmanuel', 'Josiane', 'Fabrice', 'Claudine', 'Innocent', 'Beatrice', 'Theogene', 'Alice', 'Fidele', 'Consolee', 'Alphonse', 'Vestine', 'Damascene', 'Jeannette', 'Bonaventure', 'Immaculee', 'Thierry', 'Sandrine', 'Olivier', 'Noella', 'Clement', 'Annonciata', 'Gaspar', 'Keza', 'Habimana', 'Iradukunda', 'Kwizera', 'Uwase', 'Nkurunziza', 'Mucyo']
const LAST = ['Mugisha', 'Uwimana', 'Nshimiyimana', 'Mukamana', 'Habimana', 'Uwase', 'Niyonkuru', 'Ingabire', 'Bizimana', 'Mutesi', 'Nkusi', 'Umutoni', 'Gasana', 'Kaneza', 'Ishimwe', 'Mugeni', 'Rugamba', 'Nyirahabimana', 'Twahirwa', 'Umuhoza', 'Nsengimana', 'Mukeshimana', 'Rutayisire', 'Kamanzi', 'Byiringiro', 'Uwineza', 'Maniraguha', 'Nyampinga', 'Sebahire', 'Umutesi']

const SCHOOLS = [
  ['Green Valley High School', 'GVH', 'Kigali', 'active', 'Premium', 'Diane Uwase', 26],
  ['Hillside Academy', 'HLA', 'Musanze', 'active', 'Standard', 'Eric Nshimiyimana', 24],
  ["St. Mary's College", 'SMC', 'Huye', 'active', 'Premium', 'Alice Kaneza', 22],
  ['Sunrise Secondary School', 'SSS', 'Rubavu', 'active', 'Basic', 'Patrick Bizimana', 20],
  ['Lakeside International School', 'LIS', 'Kigali', 'active', 'Premium', 'Grace Umutoni', 18],
  ['Mountain View School', 'MVS', 'Nyagatare', 'active', 'Standard', 'Samuel Rugamba', 16],
  ['Riversdale College', 'RDC', 'Rusizi', 'active', 'Standard', 'Olive Nyampinga', 14],
  ['Bright Future Academy', 'BFA', 'Kigali', 'active', 'Basic', 'David Sebahire', 12],
  ['Cedar Grove School', 'CGS', 'Muhanga', 'active', 'Standard', 'Chantal Umuhoza', 11],
  ['Horizon High School', 'HHS', 'Rwamagana', 'active', 'Premium', 'Emmanuel Gasana', 9],
  ['Unity Secondary School', 'USS', 'Gicumbi', 'active', 'Basic', 'Josiane Mutesi', 8],
  ['Palm Tree School', 'PTS', 'Karongi', 'active', 'Standard', 'Fabrice Nkusi', 7],
  ['Silverline Academy', 'SLA', 'Kigali', 'active', 'Premium', 'Claudine Ingabire', 6],
  ['New Dawn College', 'NDC', 'Nyamagabe', 'active', 'Basic', 'Innocent Twahirwa', 5],
  ['Cornerstone School', 'CTS', 'Bugesera', 'active', 'Standard', 'Beatrice Kamanzi', 4],
  ['BELLORA Model School', 'PMS', 'Kigali', 'active', 'Premium', 'Theogene Rutayisire', 3],
  ['Kingsway High School', 'KWH', 'Kigali', 'pending', 'Standard', 'Vestine Uwineza', 0.4],
  ['Bluebird Academy', 'BBA', 'Rubavu', 'pending', 'Basic', 'Damascene Niyonkuru', 0.3],
  ['Summit Prep School', 'SPS', 'Musanze', 'pending', 'Standard', 'Jeannette Mugeni', 0.2],
  ['Meadowbrook School', 'MBS', 'Huye', 'pending', 'Premium', 'Bonaventure Nsengimana', 0.1],
  ['Starlight College', 'SLC', 'Kigali', 'pending', 'Basic', 'Immaculee Ishimwe', 0.05],
  ['Oakridge Secondary School', 'ORS', 'Nyagatare', 'suspended', 'Standard', 'Thierry Byiringiro', 15],
  ['Valley View School', 'VVS', 'Muhanga', 'suspended', 'Basic', 'Sandrine Nyirahabimana', 13],
  ['Eastgate Academy', 'EGA', 'Rusizi', 'suspended', 'Standard', 'Olivier Maniraguha', 10]
]

const DEPARTMENTS = [
  ['Mathematics', 'Dr. Alphonse Mugisha'],
  ['Sciences', 'Diane Uwase'],
  ['Languages', 'Grace Umutoni'],
  ['Humanities', 'Eric Nshimiyimana'],
  ['ICT & Technology', 'Thierry Byiringiro'],
  ['Arts & Sports', 'Noella Uwase']
]

const SUBJECTS = [
  ['Mathematics', 'MATH', 0], ['Physics', 'PHY', 1], ['Chemistry', 'CHE', 1], ['Biology', 'BIO', 1],
  ['English', 'ENG', 2], ['French', 'FRE', 2], ['Kinyarwanda', 'KIN', 2], ['Literature', 'LIT', 2],
  ['History', 'HIS', 3], ['Geography', 'GEO', 3], ['Economics', 'ECO', 3],
  ['Computer Science', 'CS', 4], ['Fine Art', 'ART', 5], ['Physical Education', 'PE', 5]
]

const LEVELS = ['P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6']

const ACTIVITY_SEED = [
  ['super_admin', 'Super Admin', 'Approved school', 'school', 'BELLORA Model School', 0.04, 'success'],
  ['admin', 'Diane Uwase', 'Published timetable', 'timetable', 'Green Valley High School — Term 1', 0.1, 'success'],
  ['super_admin', 'Super Admin', 'Activated teacher account', 'user', 'Keza Iradukunda', 0.2, 'success'],
  ['system', 'System', 'Timetable conflict detected', 'conflict', 'Horizon High School', 0.3, 'warning'],
  ['dos', 'Grace Umutoni', 'Submitted new school', 'school', 'Starlight College', 0.4, 'info'],
  ['super_admin', 'Super Admin', 'Updated subscription', 'subscription', 'Silverline Academy — Premium', 0.6, 'success'],
  ['admin', 'Alice Kaneza', 'Added 24 students', 'students', "St. Mary's College", 0.8, 'info'],
  ['super_admin', 'Super Admin', 'Rejected school application', 'school', 'Northgate College', 1.1, 'danger'],
  ['system', 'System', 'Subscription expiring soon', 'subscription', 'Unity Secondary School', 1.4, 'warning'],
  ['admin', 'Samuel Rugamba', 'Generated timetable draft', 'timetable', 'Mountain View School', 1.8, 'info'],
  ['super_admin', 'Super Admin', 'Suspended school', 'school', 'Oakridge Secondary School', 2.2, 'danger'],
  ['dos', 'Olive Nyampinga', 'Created academic term', 'term', 'Term 1 — 2026/2027', 2.6, 'info'],
  ['super_admin', 'Super Admin', 'Added subject', 'subject', 'Computer Science', 3.1, 'success'],
  ['system', 'System', 'New user registered', 'user', 'Mucyo Kaneza (Teacher)', 3.5, 'info'],
  ['admin', 'Emmanuel Gasana', 'Archived timetable', 'timetable', 'Horizon High School — 2025/2026', 4.0, 'info'],
  ['super_admin', 'Super Admin', 'Approved teacher account', 'user', 'Aline Uwimana', 4.4, 'success'],
  ['system', 'System', 'Daily backup completed', 'system', 'All platform data', 5.0, 'success'],
  ['super_admin', 'Super Admin', 'Updated platform settings', 'settings', 'Notification preferences', 5.5, 'info'],
  ['admin', 'Claudine Ingabire', 'Imported class list', 'classes', 'Silverline Academy', 6.0, 'info'],
  ['system', 'System', 'Timetable conflict detected', 'conflict', 'Cedar Grove School', 6.4, 'warning']
]

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const email = (first, last, domain, n) => `${first}.${last}${n ? n : ''}@${domain}`.toLowerCase().replace(/[^a-z0-9@.]/g, '')

function generate() {
  const db = {
    meta: { version: 1, generatedAt: new Date().toISOString() },
    schools: [], users: [], subjects: [], departments: [], years: [], terms: [],
    classes: [], rooms: [], ttGroups: [], entries: [],
    activities: [], notifications: [], conflictStates: {},
    settings: {
      platformName: 'BELLORA', supportEmail: 'support@panta.rw', defaultPlan: 'Standard',
      autoApproveSchools: false, maintenanceMode: false, sessionTimeout: 30,
      emailNotifications: true, smsNotifications: false, conflictDetection: true,
      weeklyDigest: true, twoFactorRequired: false
    }
  }

  // --- Global academic structure -------------------------------------------
  db.departments = DEPARTMENTS.map(([name, head], i) => ({ id: `dep_${i + 1}`, name, head, status: 'active', createdAt: daysAgo(400 - i * 9) }))
  db.subjects = SUBJECTS.map(([name, code, dep], i) => ({ id: `sub_${i + 1}`, name, code, departmentId: `dep_${dep + 1}`, status: 'active', createdAt: daysAgo(390 - i * 7) }))
  db.years = [
    { id: 'yr_1', name: '2024/2025', startDate: '2024-09-09', endDate: '2025-07-04', status: 'archived', createdAt: daysAgo(760) },
    { id: 'yr_2', name: '2025/2026', startDate: '2025-09-08', endDate: '2026-07-03', status: 'archived', createdAt: daysAgo(390) },
    { id: 'yr_3', name: '2026/2027', startDate: '2026-09-07', endDate: '2027-07-02', status: 'active', createdAt: daysAgo(60) },
    { id: 'yr_4', name: '2027/2028', startDate: '2027-09-06', endDate: '2028-07-01', status: 'upcoming', createdAt: daysAgo(10) }
  ]
  db.terms = [
    { id: 'tm_1', name: 'Term 1', yearId: 'yr_3', startDate: '2026-09-07', endDate: '2026-12-11', status: 'active', createdAt: daysAgo(58) },
    { id: 'tm_2', name: 'Term 2', yearId: 'yr_3', startDate: '2027-01-04', endDate: '2027-03-26', status: 'upcoming', createdAt: daysAgo(58) },
    { id: 'tm_3', name: 'Term 3', yearId: 'yr_3', startDate: '2027-04-12', endDate: '2027-07-02', status: 'upcoming', createdAt: daysAgo(58) },
    { id: 'tm_4', name: 'Term 1', yearId: 'yr_2', startDate: '2025-09-08', endDate: '2025-12-12', status: 'archived', createdAt: daysAgo(388) },
    { id: 'tm_5', name: 'Term 2', yearId: 'yr_2', startDate: '2026-01-05', endDate: '2026-03-27', status: 'archived', createdAt: daysAgo(388) },
    { id: 'tm_6', name: 'Term 3', yearId: 'yr_2', startDate: '2026-04-13', endDate: '2026-07-03', status: 'archived', createdAt: daysAgo(388) }
  ]

  // --- Schools and everything inside them -----------------------------------
  let userSeq = 1
  const person = (rand) => `${FIRST[(rand() * FIRST.length) | 0]} ${LAST[(rand() * LAST.length) | 0]}`

  SCHOOLS.forEach(([name, code, district, status, plan, leader, months], i) => {
    const rand = mulberry32(i * 971 + 13)
    const schoolId = `sch_${i + 1}`
    const createdAt = daysAgo(months * 30 + rand() * 12)
    db.schools.push({
      id: schoolId, name, code, location: district, leader,
      email: `info@${code.toLowerCase()}.ac.rw`, phone: `+250 78${String(1000000 + ((rand() * 8999999) | 0)).slice(0, 7)}`,
      status, plan, createdAt,
      lastActivityAt: daysAgo(status === 'pending' ? months : rand() * 4),
      rejectReason: null
    })

    const domain = `${code.toLowerCase()}.ac.rw`
    const teacherCount = status === 'active' ? 10 + ((rand() * 9) | 0) : status === 'pending' ? 4 + ((rand() * 4) | 0) : 7
    const classCount = status === 'active' ? 6 + ((rand() * 5) | 0) : 5

    // Leadership users (school admin + DOS)
    const adminName = person(rand)
    db.users.push({ id: `usr_${userSeq++}`, name: adminName, email: email(...adminName.split(' '), domain, ''), role: 'admin', schoolId, status: status === 'suspended' ? 'suspended' : 'active', phone: `+250 7${(10000000 + rand() * 89999999) | 0}`.slice(0, 12), lastLoginAt: daysAgo(rand() * 6), createdAt })
    const dosName = person(rand)
    db.users.push({ id: `usr_${userSeq++}`, name: dosName, email: email(...dosName.split(' '), domain, ''), role: 'dos', schoolId, status: status === 'suspended' ? 'suspended' : 'active', phone: `+250 7${(10000000 + rand() * 89999999) | 0}`.slice(0, 12), lastLoginAt: daysAgo(rand() * 5), createdAt })

    // Teachers (each teaches 1–2 subjects)
    const teachers = []
    for (let t = 0; t < teacherCount; t++) {
      const tName = person(rand)
      const sub1 = `sub_${1 + ((rand() * SUBJECTS.length) | 0)}`
      let sub2 = `sub_${1 + ((rand() * SUBJECTS.length) | 0)}`
      if (sub2 === sub1) sub2 = `sub_${1 + (((rand() * SUBJECTS.length) | 0) + 3) % SUBJECTS.length}`
      const teacher = {
        id: `usr_${userSeq++}`, name: tName, email: email(...tName.split(' '), domain, t > 1 ? t : ''),
        role: 'teacher', schoolId, subjectIds: [...new Set([sub1, sub2])],
        status: status === 'suspended' ? 'suspended' : 'active',
        phone: `+250 7${(10000000 + rand() * 89999999) | 0}`.slice(0, 12),
        lastLoginAt: daysAgo(rand() * 10), createdAt
      }
      teachers.push(teacher)
      db.users.push(teacher)
    }

    // Classes + students
    const classes = []
    const usedLevels = [...LEVELS].sort(() => rand() - 0.5).slice(0, classCount)
    usedLevels.forEach((level, c) => {
      const cls = { id: `cls_${schoolId}_${c + 1}`, name: `${level} ${'AB'[(rand() * 2) | 0]}`, level, schoolId, teacherId: teachers[c % teachers.length]?.id || null, createdAt }
      classes.push(cls)
      db.classes.push(cls)
      const studentCount = status === 'active' ? 12 + ((rand() * 14) | 0) : 8
      for (let s = 0; s < studentCount; s++) {
        const sName = person(rand)
        db.users.push({
          id: `usr_${userSeq++}`, name: sName, email: email(...sName.split(' '), domain, `${c}${s}`),
          role: 'student', schoolId, classId: cls.id, status: 'active',
          lastLoginAt: daysAgo(rand() * 14), createdAt: daysAgo(months * 30 - rand() * 20)
        })
      }
    })

    // Rooms
    const rooms = []
    const roomCount = 6 + ((rand() * 5) | 0)
    for (let r = 0; r < roomCount; r++) {
      const room = { id: `rm_${schoolId}_${r + 1}`, name: r < 2 ? `Lab ${r + 1}` : `Room ${r + 1}`, type: r < 2 ? 'Lab' : 'Classroom', capacity: 30 + ((rand() * 20) | 0), schoolId }
      rooms.push(room)
      db.rooms.push(room)
    }

    // Timetables: one published group for the active term (+ drafts/archives)
    if (status !== 'pending') {
      const publishedId = `tt_${schoolId}_1`
      db.ttGroups.push({ id: publishedId, name: `Term 1 · 2026/2027`, schoolId, termId: 'tm_1', yearId: 'yr_3', status: status === 'suspended' ? 'archived' : 'published', createdAt: daysAgo(20 + rand() * 20) })
      // Track teacher/room occupancy so generated schedules are conflict-free
      // (the few demo conflicts below are injected deliberately afterwards).
      const busyTeacher = new Set()
      const busyRoom = new Set()
      classes.forEach((cls, ci) => {
        const used = new Set()
        let placed = 0
        for (let attempt = 0; attempt < 60 && placed < 8; attempt++) {
          const day = (rand() * 5) | 0
          const slot = (rand() * SLOTS.length) | 0
          const key = `${day}-${slot}`
          if (used.has(key)) continue
          const teacher = teachers[(ci * 3 + placed + ((rand() * teachers.length) | 0)) % teachers.length]
          const room = rooms[(ci + placed + ((rand() * rooms.length) | 0)) % rooms.length]
          if (busyTeacher.has(`${teacher.id}-${key}`) || busyRoom.has(`${room.id}-${key}`)) continue
          used.add(key)
          busyTeacher.add(`${teacher.id}-${key}`)
          busyRoom.add(`${room.id}-${key}`)
          db.entries.push({
            id: `en_${publishedId}_${cls.id}_${placed}`, groupId: publishedId, schoolId, classId: cls.id,
            teacherId: teacher.id, subjectId: teacher.subjectIds[0], roomId: room.id,
            day, start: SLOTS[slot][0], end: SLOTS[slot][1],
            status: status === 'suspended' ? 'archived' : 'published'
          })
          placed++
        }
      })
      // A second group in draft for some schools
      if (rand() > 0.5) {
        const draftId = `tt_${schoolId}_2`
        db.ttGroups.push({ id: draftId, name: `Term 2 · 2026/2027 (Draft)`, schoolId, termId: 'tm_2', yearId: 'yr_3', status: 'draft', createdAt: daysAgo(rand() * 8) })
        classes.slice(0, 4).forEach((cls, ci) => {
          for (let k = 0; k < 5; k++) {
            const day = (rand() * 5) | 0
            const slot = (rand() * SLOTS.length) | 0
            const teacher = teachers[(rand() * teachers.length) | 0]
            db.entries.push({
              id: `en_${draftId}_${cls.id}_${k}`, groupId: draftId, schoolId, classId: cls.id,
              teacherId: teacher.id, subjectId: teacher.subjectIds[0], roomId: rooms[(rand() * rooms.length) | 0].id,
              day, start: SLOTS[slot][0], end: SLOTS[slot][1], status: 'draft'
            })
          }
        })
      }
    }
  })

  // --- Deliberate, realistic timetable conflicts -----------------------------
  // Double-book a teacher across two classes in the same slot (published).
  ;[0, 2, 5, 9, 12].forEach((schoolIdx, n) => {
    const schoolId = `sch_${schoolIdx + 1}`
    const group = db.ttGroups.find((g) => g.schoolId === schoolId && g.status === 'published')
    if (!group) return
    const base = db.entries.find((e) => e.groupId === group.id)
    if (!base) return
    const otherClass = db.classes.find((c) => c.schoolId === schoolId && c.id !== base.classId)
    if (!otherClass) return
    db.entries.push({
      id: `en_conflict_${n}`, groupId: group.id, schoolId, classId: otherClass.id,
      teacherId: base.teacherId, subjectId: base.subjectId, roomId: base.roomId,
      day: base.day, start: base.start, end: base.end, status: 'published'
    })
  })
  // A room double-booking with different teachers.
  ;[1, 6].forEach((schoolIdx, n) => {
    const schoolId = `sch_${schoolIdx + 1}`
    const group = db.ttGroups.find((g) => g.schoolId === schoolId && g.status === 'published')
    if (!group) return
    const base = db.entries.find((e) => e.groupId === group.id)
    const otherClass = db.classes.find((c) => c.schoolId === schoolId && c.id !== base.classId)
    const otherTeacher = db.users.find((u) => u.role === 'teacher' && u.schoolId === schoolId && u.id !== base.teacherId)
    if (!base || !otherClass || !otherTeacher) return
    db.entries.push({
      id: `en_roomconf_${n}`, groupId: group.id, schoolId, classId: otherClass.id,
      teacherId: otherTeacher.id, subjectId: otherTeacher.subjectIds[0], roomId: base.roomId,
      day: base.day, start: base.start, end: base.end, status: 'published'
    })
  })

  // --- Pending user registrations (awaiting Super Admin) ---------------------
  const pendingPeople = [
    ['Mucyo Kaneza', 'teacher', 'sch_1'], ['Aline Uwimana', 'teacher', 'sch_3'],
    ['Gaspar Nkusi', 'dos', 'sch_17'], ['Noella Uwineza', 'admin', 'sch_20']
  ]
  pendingPeople.forEach(([name, role, schoolId], i) => {
    const school = db.schools.find((s) => s.id === schoolId)
    db.users.push({
      id: `usr_${userSeq++}`, name, email: email(...name.split(' '), 'panta.rw', i), role, schoolId,
      subjectIds: role === 'teacher' ? [`sub_${1 + i}`] : [],
      status: 'pending', phone: `+250 78${100000 + i}`.slice(0, 12),
      lastLoginAt: null, createdAt: daysAgo(0.2 + i * 0.3)
    })
  })

  // --- Activity + notifications ----------------------------------------------
  db.activities = ACTIVITY_SEED.map(([role, actor, action, entity, entityName, ago, status], i) => ({
    id: `act_${i + 1}`, actor, actorRole: role, action, entity, entityName, status, createdAt: daysAgo(ago)
  }))

  const pendingSchools = db.schools.filter((s) => s.status === 'pending')
  db.notifications = [
    { id: 'ntf_1', type: 'approval', title: 'School approval requested', message: `${pendingSchools[0].name} submitted a registration request.`, link: '/super-admin/approvals', read: false, createdAt: daysAgo(0.1) },
    { id: 'ntf_2', type: 'approval', title: 'School approval requested', message: `${pendingSchools[1].name} is waiting for review.`, link: '/super-admin/approvals', read: false, createdAt: daysAgo(0.2) },
    { id: 'ntf_3', type: 'user', title: 'New teacher registration', message: 'Mucyo Kaneza registered as a teacher at Green Valley High School.', link: '/super-admin/approvals', read: false, createdAt: daysAgo(0.25) },
    { id: 'ntf_4', type: 'conflict', title: 'Timetable conflict detected', message: 'Teacher double-booked at Horizon High School on Monday 08:00.', link: '/super-admin/timetables/conflicts', read: false, createdAt: daysAgo(0.3) },
    { id: 'ntf_5', type: 'conflict', title: 'Timetable conflict detected', message: 'Room Lab 1 double-booked at Hillside Academy.', link: '/super-admin/timetables/conflicts', read: false, createdAt: daysAgo(0.5) },
    { id: 'ntf_6', type: 'subscription', title: 'Subscription expiring', message: 'Unity Secondary School — Basic plan expires in 12 days.', link: '/super-admin/reports?type=subscription', read: false, createdAt: daysAgo(0.8) },
    { id: 'ntf_7', type: 'school', title: 'New school submitted', message: 'Starlight College completed its registration profile.', link: '/super-admin/approvals', read: true, createdAt: daysAgo(1.1) },
    { id: 'ntf_8', type: 'user', title: 'New DOS assigned', message: 'Grace Umutoni was assigned Director of Studies at Lakeside International.', link: '/super-admin/users/dos', read: true, createdAt: daysAgo(1.6) },
    { id: 'ntf_9', type: 'system', title: 'Backup completed', message: 'Nightly platform backup finished successfully.', link: '/super-admin/activity', read: true, createdAt: daysAgo(1.9) },
    { id: 'ntf_10', type: 'subscription', title: 'Subscription upgraded', message: 'Silverline Academy upgraded to the Premium plan.', link: '/super-admin/schools/sch_13', read: true, createdAt: daysAgo(2.3) },
    { id: 'ntf_11', type: 'system', title: 'Scheduled maintenance', message: 'Platform maintenance window: Sunday 02:00–03:00 CAT.', link: '/super-admin/settings', read: true, createdAt: daysAgo(2.8) },
    { id: 'ntf_12', type: 'approval', title: 'Teacher awaiting approval', message: 'Aline Uwimana registered at St. Mary\'s College.', link: '/super-admin/approvals', read: true, createdAt: daysAgo(3.2) }
  ]

  return db
}

export function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.meta?.version === 1) return parsed
    }
  } catch (e) {
    console.warn('Failed to load local super-admin database, regenerating.', e)
  }
  const db = generate()
  persistDb(db)
  return db
}

export function persistDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('Failed to persist local super-admin database.', e)
  }
}

export function resetDb() {
  localStorage.removeItem(DB_KEY)
  const db = generate()
  persistDb(db)
  return db
}
