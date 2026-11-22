// ============================================================================
// BELLORA Super Admin API (/api/sa)
// Every route requires a valid JWT with role = super_admin (mounted in
// index.js behind adminAuth + requireSuperAdmin). All reads/writes hit the
// real MySQL database; multi-write operations run inside transactions and
// are recorded in activity_logs.
// ============================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { computeConflicts } = require('../services/conflictScan');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const logActivity = async (req, { action, entityType, entityId = null, message = '', schoolId = null }) => {
  try {
    await pool.execute(
      `INSERT INTO activity_logs (school_id, user_id, actor_role, action, entity_type, entity_id, message, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, req.user?.id || null, req.user?.role || 'super_admin', action, entityType, entityId, message,
       (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().slice(0, 80)]
    );
  } catch (e) {
    console.error('activity log failed:', e.message);
  }
};

const asyncH = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(`[sa] ${req.method} ${req.path} failed:`, e);
  res.status(500).json({ message: 'Server error. Please try again.' });
});

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = [
  ['08:00', '08:45'], ['08:50', '09:35'], ['09:50', '10:35'], ['10:40', '11:25'],
  ['11:30', '12:15'], ['13:30', '14:15'], ['14:20', '15:05'], ['15:10', '15:55']
];

const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
const normTime = (t) => String(t || '').slice(0, 5);

// Check whether inserting/updating one entry would conflict. Returns message or null.
const entryConflict = async ({ entry, excludeId = null }) => {
  const params = [entry.school_id, entry.day_of_week, entry.end_time, entry.start_time];
  let sql = `SELECT t.timetable_id, t.class_id, t.room_id, a.teacher_id, c.class_name, tr.name AS teacher_name, r.room_name
             FROM timetable t
             LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
             LEFT JOIN class c ON c.class_id = t.class_id
             LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
             LEFT JOIN room r ON r.room_id = t.room_id
             WHERE t.school_id = ? AND t.day_of_week = ? AND t.start_time < ? AND t.end_time > ?`;
  if (excludeId) { sql += ' AND t.timetable_id <> ?'; params.push(excludeId); }
  const [rows] = await pool.execute(sql, params);
  for (const r of rows) {
    if (entry.teacher_id && r.teacher_id === Number(entry.teacher_id) && r.class_id !== Number(entry.class_id)) {
      return `Timetable conflict: ${r.teacher_name || 'This teacher'} is already assigned to ${r.class_name} on ${entry.day_of_week} ${normTime(entry.start_time)}–${normTime(entry.end_time)}.`;
    }
    if (r.class_id === Number(entry.class_id)) {
      return `Timetable conflict: ${r.class_name} already has a subject scheduled on ${entry.day_of_week} ${normTime(entry.start_time)}–${normTime(entry.end_time)}.`;
    }
    if (entry.room_id && r.room_id === Number(entry.room_id)) {
      return `Timetable conflict: ${r.room_name || 'This room'} is already booked on ${entry.day_of_week} ${normTime(entry.start_time)}–${normTime(entry.end_time)}.`;
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Overview KPIs
// ---------------------------------------------------------------------------
router.get('/overview', asyncH(async (req, res) => {
  const [[schools]] = await pool.query(`SELECT COUNT(*) total, SUM(status='active') active, SUM(status='pending_approval') pending FROM schools WHERE deleted_at IS NULL`);
  const [[users]] = await pool.query(`SELECT COUNT(*) total, SUM(role='teacher') teachers, SUM(role='student') students, SUM(role='dos') dos, SUM(role='admin') admins, SUM(status='pending') pending FROM users`);
  const [[teacherRows]] = await pool.query(`SELECT COUNT(*) n FROM teacher`);
  const [[studentRows]] = await pool.query(`SELECT COUNT(*) n FROM student`);
  const [[tt]] = await pool.query(`SELECT COUNT(DISTINCT CONCAT(school_id,'|',academic_year,'|',term)) groups_total,
                                   COUNT(DISTINCT IF(status='published', CONCAT(school_id,'|',academic_year,'|',term), NULL)) published
                                   FROM timetable`);
  const conflicts = await computeConflicts();
  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') ym, COUNT(*) n FROM (
      SELECT created_at FROM schools WHERE deleted_at IS NULL
      UNION ALL SELECT created_at FROM users
    ) x GROUP BY ym ORDER BY ym`);

  res.json({
    totalSchools: Number(schools.total || 0),
    activeSchools: Number(schools.active || 0),
    pendingSchools: Number(schools.pending || 0),
    totalUsers: Number(users.total || 0),
    pendingUsers: Number(users.pending || 0),
    teachers: Math.max(Number(users.teachers || 0), Number(teacherRows.n || 0)),
    students: Math.max(Number(users.students || 0), Number(studentRows.n || 0)),
    dos: Number(users.dos || 0),
    admins: Number(users.admins || 0),
    timetableGroups: Number(tt.groups_total || 0),
    publishedTimetables: Number(tt.published || 0),
    openConflicts: conflicts.length,
    monthly
  });
}));

// ---------------------------------------------------------------------------
// School core-field update (lifecycle actions live in routes/schools.js)
// ---------------------------------------------------------------------------
router.put('/schools/:id', asyncH(async (req, res) => {
  const { school_name, school_code, school_email, phone, district, province, sector, school_address, subscription_plan } = req.body || {};
  if (school_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(school_email)) {
    return res.status(400).json({ message: 'A valid school email is required.' });
  }
  const [r] = await pool.execute(
    `UPDATE schools SET
       school_name = COALESCE(?, school_name), school_code = COALESCE(?, school_code),
       school_email = COALESCE(?, school_email), phone = COALESCE(?, phone),
       district = COALESCE(?, district), province = COALESCE(?, province), sector = COALESCE(?, sector),
       school_address = COALESCE(?, school_address), subscription_plan = COALESCE(?, subscription_plan)
     WHERE school_id = ? AND deleted_at IS NULL`,
    [school_name || null, school_code || null, school_email || null, phone || null,
     district || null, province || null, sector || null, school_address || null, subscription_plan || null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'School not found.' });
  await logActivity(req, { action: 'Updated school', entityType: 'school', entityId: req.params.id, message: school_name || '', schoolId: req.params.id });
  const [[school]] = await pool.query('SELECT * FROM schools WHERE school_id = ?', [req.params.id]);
  res.json({ message: 'School updated.', school });
}));

// ---------------------------------------------------------------------------
// Users (unified across roles)
// ---------------------------------------------------------------------------
router.get('/users', asyncH(async (req, res) => {
  const { q = '', role = '', school_id = '', status = '', page = 1, limit = 500, sort = 'full_name', dir = 'asc' } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (school_id) { where.push('u.school_id = ?'); params.push(school_id); }
  if (status) { where.push('u.status = ?'); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = ['full_name', 'email', 'role', 'status', 'created_at', 'last_login'].includes(sort) ? sort : 'full_name';
  const sortDir = dir === 'desc' ? 'DESC' : 'ASC';
  const lim = Math.min(Number(limit) || 500, 1000);
  const off = (Math.max(1, Number(page)) - 1) * lim;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) total FROM users u ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.email, u.role, u.school_id, u.status, u.phone,
            u.last_login, u.created_at, s.school_name, t.teacher_id, st.student_id, st.class_id
     FROM users u
     LEFT JOIN schools s ON s.school_id = u.school_id
     LEFT JOIN teacher t ON t.email = u.email
     LEFT JOIN student st ON st.user_id = u.id
     ${whereSql}
     ORDER BY u.${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`, [...params, lim, off]);
  res.json({ total, page: Number(page), limit: lim, items: rows });
}));

router.post('/users', asyncH(async (req, res) => {
  const { full_name, email, role, school_id = null, phone = null, status = 'active', password } = req.body || {};
  if (!full_name || full_name.trim().length < 3) return res.status(400).json({ message: 'Full name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ message: 'A valid email address is required.' });
  if (!['student', 'teacher', 'dos', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role.' });
  if (!['active', 'pending', 'suspended'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });

  const [dup] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (dup.length) return res.status(409).json({ message: 'An account with this email already exists.' });

  const hash = await bcrypt.hash(password && password.length >= 8 ? password : 'Panta@123', 10);
  const username = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 90);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO users (username, email, full_name, password, password_hash, role, school_id, phone, status, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [username, email, full_name.trim(), hash, hash, role, school_id, phone, status]);
    const userId = r.insertId;
    if (role === 'teacher') {
      await conn.execute(
        `INSERT INTO teacher (name, email, password, status, date_joined, school_id, phone) VALUES (?, ?, ?, ?, CURDATE(), ?, ?)`,
        [full_name.trim(), email, hash, status === 'active' ? 'active' : 'pending', school_id, phone]);
    }
    if (role === 'student') {
      await conn.execute(
        `INSERT INTO student (user_id, student_number, name, email, school_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, `STU-${String(userId).padStart(5, '0')}`, full_name.trim(), email, school_id]);
    }
    await conn.commit();
    await logActivity(req, { action: 'Added user', entityType: 'user', entityId: userId, message: `${full_name} (${role})`, schoolId: school_id });
    const [[created]] = await pool.query('SELECT id, username, full_name, email, role, school_id, status, phone, last_login, created_at FROM users WHERE id = ?', [userId]);
    res.status(201).json({ message: 'User created.', user: created });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

router.put('/users/:id', asyncH(async (req, res) => {
  const { full_name, email, role, school_id = null, phone = null, status } = req.body || {};
  const [[existing]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found.' });
  if (existing.role === 'super_admin' && role && role !== 'super_admin') {
    return res.status(400).json({ message: 'The Super Admin account role cannot be changed here.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'A valid email address is required.' });
  if (role && !['student', 'teacher', 'dos', 'admin', 'super_admin'].includes(role)) return res.status(400).json({ message: 'Invalid role.' });
  if (status && !['pending', 'active', 'disabled', 'suspended', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
  if (email) {
    const [dup] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?', [email, req.params.id]);
    if (dup.length) return res.status(409).json({ message: 'An account with this email already exists.' });
  }
  await pool.execute(
    `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), role = COALESCE(?, role),
       school_id = ?, phone = COALESCE(?, phone), status = COALESCE(?, status) WHERE id = ?`,
    [full_name || null, email || null, role || null, school_id, phone, status || null, req.params.id]);
  await logActivity(req, { action: 'Updated user', entityType: 'user', entityId: req.params.id, message: full_name || existing.full_name });
  const [[updated]] = await pool.query('SELECT id, username, full_name, email, role, school_id, status, phone, last_login, created_at FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'User updated.', user: updated });
}));

router.put('/users/:id/status', asyncH(async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'active', 'disabled', 'suspended', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  const [[existing]] = await pool.query('SELECT id, full_name, role FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found.' });
  if (existing.role === 'super_admin') return res.status(400).json({ message: 'The Super Admin account cannot be modified.' });
  await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
  const verbs = { active: 'Activated', pending: 'Marked pending for', disabled: 'Disabled', suspended: 'Suspended', rejected: 'Rejected' };
  await logActivity(req, { action: `${verbs[status]} ${existing.role} account`, entityType: 'user', entityId: req.params.id, message: existing.full_name });
  res.json({ message: 'Status updated.' });
}));

router.delete('/users/:id', asyncH(async (req, res) => {
  const [[existing]] = await pool.query('SELECT id, full_name, role FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found.' });
  if (existing.role === 'super_admin') return res.status(400).json({ message: 'The Super Admin account cannot be deleted.' });
  await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
  await logActivity(req, { action: 'Deleted user', entityType: 'user', entityId: req.params.id, message: existing.full_name });
  res.json({ message: 'User deleted.' });
}));

router.post('/users/:id/reset-password', asyncH(async (req, res) => {
  const [[existing]] = await pool.query('SELECT id, email, full_name, role FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found.' });
  const temp = `Panta@${Math.random().toString(36).slice(2, 8)}`;
  const hash = await bcrypt.hash(temp, 10);
  await pool.execute('UPDATE users SET password = ?, password_hash = ? WHERE id = ?', [hash, hash, req.params.id]);
  // Teachers authenticate against the teacher table — keep credentials in sync.
  if (existing.role === 'teacher') {
    await pool.execute('UPDATE teacher SET password = ? WHERE LOWER(email) = LOWER(?)', [hash, existing.email]);
  }
  await logActivity(req, { action: 'Reset user password', entityType: 'user', entityId: req.params.id, message: existing.full_name });
  res.json({ message: `Password reset for ${existing.email}. Temporary password: ${temp}` });
}));

// ---------------------------------------------------------------------------
// Academic years / terms / departments (global + per-school)
// ---------------------------------------------------------------------------
const crudFor = ({ table, idCol, validate }) => {
  router.get(`/${table}`, asyncH(async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${idCol} DESC LIMIT 500`);
    res.json({ items: rows });
  }));
  router.post(`/${table}`, asyncH(async (req, res) => {
    const err = validate?.(req.body);
    if (err) return res.status(400).json({ message: err });
    const { name, start_date = null, end_date = null, status = 'active', year_id = null, head = null, school_id = null } = req.body || {};
    const cols = ['name', 'status', 'school_id'];
    const vals = [name, status, school_id];
    if (table !== 'department') { cols.push('start_date', 'end_date'); vals.push(start_date, end_date); }
    if (table === 'term') { cols.push('year_id'); vals.push(year_id); }
    if (table === 'department') { cols.push('head'); vals.push(head); }
    const [r] = await pool.execute(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
    await logActivity(req, { action: `Added ${table.replace('_', ' ')}`, entityType: table, entityId: r.insertId, message: name });
    const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE ${idCol} = ?`, [r.insertId]);
    res.status(201).json({ message: 'Created.', item: row });
  }));
  router.put(`/${table}/:id`, asyncH(async (req, res) => {
    const { name, start_date, end_date, status, year_id, head } = req.body || {};
    const sets = ['name = COALESCE(?, name)', 'status = COALESCE(?, status)'];
    const vals = [name || null, status || null];
    if (table !== 'department') { sets.push('start_date = COALESCE(?, start_date)', 'end_date = COALESCE(?, end_date)'); vals.push(start_date || null, end_date || null); }
    if (table === 'term') { sets.push('year_id = COALESCE(?, year_id)'); vals.push(year_id || null); }
    if (table === 'department') { sets.push('head = COALESCE(?, head)'); vals.push(head || null); }
    vals.push(req.params.id);
    const [r] = await pool.execute(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${idCol} = ?`, vals);
    if (!r.affectedRows) return res.status(404).json({ message: 'Not found.' });
    await logActivity(req, { action: `Updated ${table.replace('_', ' ')}`, entityType: table, entityId: req.params.id, message: name || '' });
    const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE ${idCol} = ?`, [req.params.id]);
    res.json({ message: 'Updated.', item: row });
  }));
  router.delete(`/${table}/:id`, asyncH(async (req, res) => {
    const [r] = await pool.query(`DELETE FROM ${table} WHERE ${idCol} = ?`, [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Not found.' });
    await logActivity(req, { action: `Deleted ${table.replace('_', ' ')}`, entityType: table, entityId: req.params.id });
    res.json({ message: 'Deleted.' });
  }));
};

crudFor({ table: 'academic_year', idCol: 'year_id', validate: (b) => (!b?.name || !b?.start_date || !b?.end_date ? 'Name, start date and end date are required.' : (b.end_date <= b.start_date ? 'End date must be after the start date.' : null)) });
crudFor({ table: 'term', idCol: 'term_id', validate: (b) => (!b?.name || !b?.year_id || !b?.start_date || !b?.end_date ? 'Name, academic year and dates are required.' : (b.end_date <= b.start_date ? 'End date must be after the start date.' : null)) });
crudFor({ table: 'department', idCol: 'department_id', validate: (b) => (!b?.name ? 'Department name is required.' : null) });

// ---------------------------------------------------------------------------
// Subjects (module table)
// ---------------------------------------------------------------------------
router.get('/subjects', asyncH(async (req, res) => {
  const { q = '', school_id = '', department = '' } = req.query;
  const where = []; const params = [];
  if (q) { where.push('module_name LIKE ?'); params.push(`%${q}%`); }
  if (school_id) { where.push('school_id = ?'); params.push(school_id); }
  if (department) { where.push('department = ?'); params.push(department); }
  const [rows] = await pool.query(
    `SELECT module_id, module_name, department, hours_per_year, description, school_id, required_room_type, created_at
     FROM module ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY module_name LIMIT 500`, params);
  res.json({ items: rows });
}));

router.post('/subjects', asyncH(async (req, res) => {
  const { module_name, department = null, hours_per_year = null, description = null, school_id = null } = req.body || {};
  if (!module_name || module_name.trim().length < 2) return res.status(400).json({ message: 'Subject name is required.' });
  const [dup] = await pool.execute('SELECT module_id FROM module WHERE LOWER(module_name) = LOWER(?) AND COALESCE(school_id, 0) = COALESCE(?, 0)', [module_name, school_id]);
  if (dup.length) return res.status(409).json({ message: 'This subject already exists for this school.' });
  const [r] = await pool.execute(
    'INSERT INTO module (module_name, department, hours_per_year, description, school_id) VALUES (?, ?, ?, ?, ?)',
    [module_name.trim(), department, hours_per_year ?? 0, description, school_id]);
  await logActivity(req, { action: 'Added subject', entityType: 'subject', entityId: r.insertId, message: module_name });
  const [[row]] = await pool.query('SELECT * FROM module WHERE module_id = ?', [r.insertId]);
  res.status(201).json({ message: 'Subject created.', item: row });
}));

router.put('/subjects/:id', asyncH(async (req, res) => {
  const { module_name, department, hours_per_year, description } = req.body || {};
  const [r] = await pool.execute(
    `UPDATE module SET module_name = COALESCE(?, module_name), department = COALESCE(?, department),
       hours_per_year = COALESCE(?, hours_per_year), description = COALESCE(?, description) WHERE module_id = ?`,
    [module_name || null, department || null, hours_per_year || null, description || null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Subject not found.' });
  await logActivity(req, { action: 'Updated subject', entityType: 'subject', entityId: req.params.id, message: module_name || '' });
  const [[row]] = await pool.query('SELECT * FROM module WHERE module_id = ?', [req.params.id]);
  res.json({ message: 'Subject updated.', item: row });
}));

router.delete('/subjects/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT assignment_id FROM assignment WHERE module_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This subject is used by teaching assignments and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM module WHERE module_id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Subject not found.' });
  await logActivity(req, { action: 'Deleted subject', entityType: 'subject', entityId: req.params.id });
  res.json({ message: 'Subject deleted.' });
}));

// ---------------------------------------------------------------------------
// Classes (class + section info, with student counts)
// ---------------------------------------------------------------------------
router.get('/classes', asyncH(async (req, res) => {
  const { q = '', school_id = '' } = req.query;
  const where = []; const params = [];
  if (q) { where.push('c.class_name LIKE ?'); params.push(`%${q}%`); }
  if (school_id) { where.push('c.school_id = ?'); params.push(school_id); }
  const [rows] = await pool.query(
    `SELECT c.class_id, c.class_name, c.level, c.academic_year, c.school_id, c.class_teacher_id, c.room_id,
            s.school_name, sec.section_name, t.name AS class_teacher_name,
            (SELECT COUNT(*) FROM student st WHERE st.class_id = c.class_id) AS student_count,
            c.created_at
     FROM class c
     LEFT JOIN schools s ON s.school_id = c.school_id
     LEFT JOIN section sec ON sec.section_id = c.section_id
     LEFT JOIN teacher t ON t.teacher_id = c.class_teacher_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.class_name LIMIT 500`, params);
  res.json({ items: rows });
}));

router.post('/classes', asyncH(async (req, res) => {
  const { class_name, level = null, academic_year = null, school_id, class_teacher_id = null, room_id = null } = req.body || {};
  if (!class_name || class_name.trim().length < 2) return res.status(400).json({ message: 'Class name is required.' });
  if (!school_id) return res.status(400).json({ message: 'School is required.' });
  const [dup] = await pool.execute('SELECT class_id FROM class WHERE LOWER(class_name) = LOWER(?) AND school_id = ?', [class_name, school_id]);
  if (dup.length) return res.status(409).json({ message: 'This class already exists in this school.' });
  const [r] = await pool.execute(
    'INSERT INTO class (class_name, level, academic_year, school_id, class_teacher_id, room_id) VALUES (?, ?, ?, ?, ?, ?)',
    [class_name.trim(), level, academic_year, school_id, class_teacher_id, room_id]);
  await logActivity(req, { action: 'Added class', entityType: 'class', entityId: r.insertId, message: class_name, schoolId: school_id });
  const [[row]] = await pool.query('SELECT * FROM class WHERE class_id = ?', [r.insertId]);
  res.status(201).json({ message: 'Class created.', item: row });
}));

router.put('/classes/:id', asyncH(async (req, res) => {
  const { class_name, level, academic_year, class_teacher_id, room_id } = req.body || {};
  const [r] = await pool.execute(
    `UPDATE class SET class_name = COALESCE(?, class_name), level = COALESCE(?, level), academic_year = COALESCE(?, academic_year),
       class_teacher_id = COALESCE(?, class_teacher_id), room_id = COALESCE(?, room_id) WHERE class_id = ?`,
    [class_name || null, level || null, academic_year || null, class_teacher_id || null, room_id || null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Class not found.' });
  await logActivity(req, { action: 'Updated class', entityType: 'class', entityId: req.params.id, message: class_name || '' });
  res.json({ message: 'Class updated.' });
}));

router.delete('/classes/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT timetable_id FROM timetable WHERE class_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This class has timetable entries and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM class WHERE class_id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Class not found.' });
  await logActivity(req, { action: 'Deleted class', entityType: 'class', entityId: req.params.id });
  res.json({ message: 'Class deleted.' });
}));

// ---------------------------------------------------------------------------
// Rooms (full management)
// ---------------------------------------------------------------------------
router.get('/rooms', asyncH(async (req, res) => {
  const { school_id = '' } = req.query;
  const params = [];
  let where = '';
  if (school_id) { where = 'WHERE r.school_id = ?'; params.push(school_id); }
  const [rows] = await pool.query(
    `SELECT r.room_id, r.room_name, r.room_type, r.capacity, r.school_id FROM room r ${where} ORDER BY r.room_name LIMIT 500`, params);
  res.json({ items: rows });
}));

router.post('/rooms', asyncH(async (req, res) => {
  const { room_name, room_type = 'Classroom', capacity = 40, school_id } = req.body || {};
  if (!room_name || room_name.trim().length < 2) return res.status(400).json({ message: 'Room name is required.' });
  if (!school_id) return res.status(400).json({ message: 'School is required.' });
  const [dup] = await pool.execute('SELECT room_id FROM room WHERE LOWER(room_name) = LOWER(?) AND school_id = ?', [room_name, school_id]);
  if (dup.length) return res.status(409).json({ message: 'This room already exists in this school.' });
  const [r] = await pool.execute('INSERT INTO room (room_name, room_type, capacity, school_id) VALUES (?, ?, ?, ?)',
    [room_name.trim(), room_type, capacity, school_id]);
  await logActivity(req, { action: 'Added room', entityType: 'room', entityId: r.insertId, message: room_name, schoolId: school_id });
  res.status(201).json({ message: 'Room created.', id: r.insertId });
}));

router.put('/rooms/:id', asyncH(async (req, res) => {
  const { room_name, room_type, capacity } = req.body || {};
  const [r] = await pool.execute(
    'UPDATE room SET room_name = COALESCE(?, room_name), room_type = COALESCE(?, room_type), capacity = COALESCE(?, capacity) WHERE room_id = ?',
    [room_name || null, room_type || null, capacity || null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Room not found.' });
  await logActivity(req, { action: 'Updated room', entityType: 'room', entityId: req.params.id, message: room_name || '' });
  res.json({ message: 'Room updated.' });
}));

router.delete('/rooms/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT timetable_id FROM timetable WHERE room_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This room is used by timetable entries and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM room WHERE room_id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Room not found.' });
  await logActivity(req, { action: 'Deleted room', entityType: 'room', entityId: req.params.id });
  res.json({ message: 'Room deleted.' });
}));

// ---------------------------------------------------------------------------
// Timetables
// ---------------------------------------------------------------------------
// Groups = distinct (school, academic_year, term, status) clusters of entries.
router.get('/timetables', asyncH(async (req, res) => {
  const { status = '', school_id = '' } = req.query;
  const where = []; const params = [];
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (school_id) { where.push('t.school_id = ?'); params.push(school_id); }
  where.push("t.academic_year IS NOT NULL AND t.academic_year <> ''", "t.term IS NOT NULL AND t.term <> ''");
  const [rows] = await pool.query(
    `SELECT t.school_id, t.academic_year, t.term, t.status, s.school_name,
            COUNT(*) periods, COUNT(DISTINCT t.class_id) classes, MIN(t.created_at) created_at
     FROM timetable t LEFT JOIN schools s ON s.school_id = t.school_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY t.school_id, t.academic_year, t.term, t.status, s.school_name
     ORDER BY created_at DESC LIMIT 300`, params);
  res.json({ items: rows });
}));

router.get('/timetables/entries', asyncH(async (req, res) => {
  const { school_id, academic_year, term, class_id = '', teacher_id = '', room_id = '', day = '' } = req.query;
  if (!school_id || !academic_year || !term) return res.status(400).json({ message: 'school_id, academic_year and term are required.' });
  const params = [school_id, academic_year, term];
  let extra = '';
  if (class_id) { extra += ' AND t.class_id = ?'; params.push(class_id); }
  if (teacher_id) { extra += ' AND a.teacher_id = ?'; params.push(teacher_id); }
  if (room_id) { extra += ' AND t.room_id = ?'; params.push(room_id); }
  if (day) { extra += ' AND t.day_of_week = ?'; params.push(day); }
  const [rows] = await pool.query(
    `SELECT t.timetable_id, t.school_id, t.class_id, t.assignment_id, t.day_of_week,
            TIME_FORMAT(t.start_time, '%H:%i') start_time, TIME_FORMAT(t.end_time, '%H:%i') end_time,
            t.room_id, t.module_name, t.status, t.academic_year, t.term,
            a.teacher_id, a.module_id, tr.name teacher_name, c.class_name, r.room_name
     FROM timetable t
     LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
     LEFT JOIN class c ON c.class_id = t.class_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE t.school_id = ? AND t.academic_year = ? AND t.term = ? ${extra}
     ORDER BY t.day_of_week, t.start_time`, params);
  res.json({ items: rows });
}));

// Publish / archive / draft an entire group (transactional).
router.put('/timetables/status', asyncH(async (req, res) => {
  const { school_id, academic_year, term, status } = req.body || {};
  if (!school_id || !academic_year || !term || !['draft', 'published', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'school_id, academic_year, term and a valid status are required.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      'UPDATE timetable SET status = ? WHERE school_id = ? AND academic_year = ? AND term = ?',
      [status, school_id, academic_year, term]);
    if (!r.affectedRows) { await conn.rollback(); return res.status(404).json({ message: 'Timetable group not found.' }); }
    await conn.commit();
    const verbs = { published: 'Published timetable', archived: 'Archived timetable', draft: 'Moved timetable to draft' };
    await logActivity(req, { action: verbs[status], entityType: 'timetable', message: `${academic_year} ${term} (${r.affectedRows} periods)`, schoolId: school_id });
    res.json({ message: `Timetable ${status}.`, affected: r.affectedRows });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// Delete a whole group (draft/archived only).
router.delete('/timetables/group', asyncH(async (req, res) => {
  const { school_id, academic_year, term } = req.body || {};
  const [[live]] = await pool.query(
    "SELECT COUNT(*) n FROM timetable WHERE school_id = ? AND academic_year = ? AND term = ? AND status = 'published'",
    [school_id, academic_year, term]);
  if (live.n > 0) return res.status(400).json({ message: 'Published timetables cannot be deleted. Archive the timetable first.' });
  const [r] = await pool.execute('DELETE FROM timetable WHERE school_id = ? AND academic_year = ? AND term = ?', [school_id, academic_year, term]);
  await logActivity(req, { action: 'Deleted timetable', entityType: 'timetable', message: `${academic_year} ${term} (${r.affectedRows} periods)`, schoolId: school_id });
  res.json({ message: 'Timetable deleted.', affected: r.affectedRows });
}));

// Single-entry CRUD with hard conflict checks.
router.post('/timetables/entries', asyncH(async (req, res) => {
  const { school_id, class_id, assignment_id, day_of_week, start_time, end_time, room_id = null, module_name = null, academic_year, term } = req.body || {};
  if (!school_id || !class_id || !assignment_id || !day_of_week || !start_time || !end_time || !academic_year || !term) {
    return res.status(400).json({ message: 'All scheduling fields are required.' });
  }
  if (end_time <= start_time) return res.status(400).json({ message: 'End time must be after start time.' });
  const [[asg]] = await pool.query('SELECT teacher_id, module_id FROM assignment WHERE assignment_id = ?', [assignment_id]);
  if (!asg) return res.status(400).json({ message: 'Invalid teaching assignment.' });
  const conflict = await entryConflict({ entry: { school_id, class_id, teacher_id: asg.teacher_id, room_id, day_of_week, start_time, end_time } });
  if (conflict) return res.status(409).json({ message: conflict, code: 'TIMETABLE_CONFLICT' });
  const [r] = await pool.execute(
    `INSERT INTO timetable (class_id, assignment_id, day_of_week, start_time, end_time, room_id, module_name, school_id, status, academic_year, term)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [class_id, assignment_id, day_of_week, start_time, end_time, room_id, module_name, school_id, academic_year, term]);
  await logActivity(req, { action: 'Added timetable entry', entityType: 'timetable', entityId: r.insertId, schoolId: school_id });
  res.status(201).json({ message: 'Entry added.', id: r.insertId });
}));

router.put('/timetables/entries/:id', asyncH(async (req, res) => {
  const [[cur]] = await pool.query('SELECT t.*, a.teacher_id FROM timetable t LEFT JOIN assignment a ON a.assignment_id = t.assignment_id WHERE t.timetable_id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ message: 'Entry not found.' });
  const next = {
    day_of_week: req.body.day_of_week || cur.day_of_week,
    start_time: req.body.start_time || normTime(cur.start_time),
    end_time: req.body.end_time || normTime(cur.end_time),
    room_id: req.body.room_id !== undefined ? req.body.room_id : cur.room_id
  };
  if (next.end_time <= next.start_time) return res.status(400).json({ message: 'End time must be after start time.' });
  const conflict = await entryConflict({ entry: { ...cur, ...next }, excludeId: cur.timetable_id });
  if (conflict) return res.status(409).json({ message: conflict, code: 'TIMETABLE_CONFLICT' });
  await pool.execute('UPDATE timetable SET day_of_week = ?, start_time = ?, end_time = ?, room_id = ? WHERE timetable_id = ?',
    [next.day_of_week, next.start_time, next.end_time, next.room_id, cur.timetable_id]);
  await logActivity(req, { action: 'Moved timetable entry', entityType: 'timetable', entityId: cur.timetable_id, schoolId: cur.school_id });
  res.json({ message: 'Entry updated.' });
}));

router.delete('/timetables/entries/:id', asyncH(async (req, res) => {
  const [r] = await pool.execute('DELETE FROM timetable WHERE timetable_id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Entry not found.' });
  await logActivity(req, { action: 'Deleted timetable entry', entityType: 'timetable', entityId: req.params.id });
  res.json({ message: 'Entry deleted.' });
}));

// Conflict scan (all schools or one).
router.get('/timetable-conflicts', asyncH(async (req, res) => {
  const conflicts = await computeConflicts(req.query.school_id || null);
  res.json({ items: conflicts });
}));

// Assignments (teaching assignments) — needed by the generator + entry form.
router.get('/assignments', asyncH(async (req, res) => {
  const { school_id = '' } = req.query;
  const params = []; let where = '';
  if (school_id) { where = 'WHERE a.school_id = ?'; params.push(school_id); }
  const [rows] = await pool.query(
    `SELECT a.assignment_id, a.teacher_id, a.module_id, a.class_id, a.academic_year, a.term, a.school_id,
            t.name teacher_name, t.available_days, TIME_FORMAT(t.available_from, '%H:%i') available_from,
            TIME_FORMAT(t.available_to, '%H:%i') available_to,
            m.module_name, c.class_name
     FROM assignment a
     LEFT JOIN teacher t ON t.teacher_id = a.teacher_id
     LEFT JOIN module m ON m.module_id = a.module_id
     LEFT JOIN class c ON c.class_id = a.class_id
     ${where} ORDER BY c.class_name, m.module_name LIMIT 1000`, params);
  res.json({ items: rows });
}));

// Create a teaching assignment (teacher + subject + class for a year/term).
router.post('/assignments', asyncH(async (req, res) => {
  const { teacher_id, module_id, class_id, academic_year, term, school_id } = req.body || {};
  if (!teacher_id || !module_id || !class_id || !academic_year || !term || !school_id) {
    return res.status(400).json({ message: 'teacher_id, module_id, class_id, academic_year, term and school_id are required.' });
  }
  const [dup] = await pool.execute(
    'SELECT assignment_id FROM assignment WHERE teacher_id = ? AND module_id = ? AND class_id = ? AND academic_year = ? AND term = ?',
    [teacher_id, module_id, class_id, academic_year, term]);
  if (dup.length) return res.status(409).json({ message: 'This teaching assignment already exists.' });
  const [r] = await pool.execute(
    'INSERT INTO assignment (teacher_id, module_id, class_id, academic_year, term, school_id) VALUES (?, ?, ?, ?, ?, ?)',
    [teacher_id, module_id, class_id, academic_year, term, school_id]);
  await logActivity(req, { action: 'Created teaching assignment', entityType: 'assignment', entityId: r.insertId, schoolId: school_id });
  res.status(201).json({ message: 'Assignment created.', id: r.insertId });
}));

router.delete('/assignments/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT timetable_id FROM timetable WHERE assignment_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This assignment is used by timetable entries and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM assignment WHERE assignment_id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Assignment not found.' });
  await logActivity(req, { action: 'Deleted teaching assignment', entityType: 'assignment', entityId: req.params.id });
  res.json({ message: 'Assignment deleted.' });
}));

// Timetable generator — constraint-based, transaction-safe, creates a DRAFT.
router.post('/timetables/generate', asyncH(async (req, res) => {
  const { school_id, academic_year, term, periods_per_class = 24 } = req.body || {};
  if (!school_id || !academic_year || !term) {
    return res.status(400).json({ message: 'school_id, academic_year and term are required.' });
  }
  const [classes] = await pool.query('SELECT class_id, class_name FROM class WHERE school_id = ? ORDER BY class_name', [school_id]);
  const [assignments] = await pool.query(
    `SELECT a.assignment_id, a.teacher_id, a.module_id, a.class_id, m.module_name,
            t.available_days, TIME_FORMAT(t.available_from, '%H:%i') available_from, TIME_FORMAT(t.available_to, '%H:%i') available_to
     FROM assignment a
     LEFT JOIN module m ON m.module_id = a.module_id
     LEFT JOIN teacher t ON t.teacher_id = a.teacher_id
     WHERE a.school_id = ?`, [school_id]);
  const [rooms] = await pool.query('SELECT room_id, room_name FROM room WHERE school_id = ? ORDER BY room_name', [school_id]);
  if (!classes.length || !assignments.length || !rooms.length) {
    return res.status(400).json({ message: 'The school needs classes, teaching assignments and rooms before a timetable can be generated.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Replace any previous draft for the same group
    await conn.execute(
      "DELETE FROM timetable WHERE school_id = ? AND academic_year = ? AND term = ? AND status = 'draft'",
      [school_id, academic_year, term]);

    const busyTeacher = new Set();
    const busyRoom = new Set();
    let created = 0;
    const perClass = Math.max(10, Math.min(40, Number(periods_per_class) || 24));

    for (let ci = 0; ci < classes.length; ci++) {
      const cls = classes[ci];
      const classAssignments = assignments.filter((a) => a.class_id === cls.class_id);
      if (!classAssignments.length) continue;
      let placed = 0; let ai = 0;
      for (let slotIdx = 0; slotIdx < DAYS.length * SLOTS.length && placed < perClass; slotIdx++) {
        const day = DAYS[slotIdx % DAYS.length];
        const [start, end] = SLOTS[(slotIdx + ci) % SLOTS.length];
        const asg = classAssignments[ai % classAssignments.length];
        ai++;
        const key = `${day}-${start}`;
        const room = rooms[(slotIdx + ci) % rooms.length];
        // Teacher availability (hard constraint)
        if (asg.available_days) {
          const allowed = String(asg.available_days).toLowerCase();
          if (!allowed.includes(day.toLowerCase().slice(0, 3))) continue;
        }
        if (asg.available_from && normTime(asg.available_from) > start) continue;
        if (asg.available_to && normTime(asg.available_to) < end) continue;
        if (busyTeacher.has(`${asg.teacher_id}-${key}`) || busyRoom.has(`${room.room_id}-${key}`)) continue;
        busyTeacher.add(`${asg.teacher_id}-${key}`);
        busyRoom.add(`${room.room_id}-${key}`);
        await conn.execute(
          `INSERT INTO timetable (class_id, assignment_id, day_of_week, start_time, end_time, room_id, module_name, school_id, status, academic_year, term)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [cls.class_id, asg.assignment_id, day, start, end, room.room_id, asg.module_name, school_id, academic_year, term]);
        created++;
        placed++;
      }
    }

    await conn.commit();
    await logActivity(req, { action: 'Generated timetable draft', entityType: 'timetable', message: `${academic_year} ${term} — ${created} periods`, schoolId: school_id });
    res.status(201).json({ message: `Draft timetable generated with ${created} periods.`, created, group: { school_id, academic_year, term, status: 'draft' } });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// ---------------------------------------------------------------------------
// Activity / audit trail
// ---------------------------------------------------------------------------
router.get('/activity', asyncH(async (req, res) => {
  const { q = '', actor_role = '', page = 1, limit = 200 } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(a.action LIKE ? OR a.message LIKE ? OR u.full_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (actor_role) { where.push('a.actor_role = ?'); params.push(actor_role); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const lim = Math.min(Number(limit) || 200, 500);
  const off = (Math.max(1, Number(page)) - 1) * lim;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) total FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT a.activity_id, a.action, a.entity_type, a.entity_id, a.message, a.actor_role, a.created_at,
            COALESCE(u.full_name, u.username, 'System') actor
     FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
     ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [...params, lim, off]);
  res.json({ total, items: rows });
}));

module.exports = router;
