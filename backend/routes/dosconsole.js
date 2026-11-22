// ============================================================================
// BELLORA Director of Studies console API (/api/dos-console)
// School-scoped: every query is restricted to req.user.school_id, enforced
// server-side (never trusts frontend school ids). Mounted behind adminAuth +
// requireSchoolAdmin (roles: dos, admin).
// ============================================================================

const express = require('express');
const pool = require('../config/database');
const SystemSetting = require('../models/SystemSetting');
const { computeConflicts } = require('../services/conflictScan');

const router = express.Router();

const asyncH = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(`[dos-console] ${req.method} ${req.path} failed:`, e);
  res.status(500).json({ message: 'Server error. Please try again.' });
});

const schoolOf = (req) => req.user.school_id;

// ---------------------------------------------------------------------------
// Overview: classes / teachers / subjects / students + timetable summary
// ---------------------------------------------------------------------------
router.get('/overview', asyncH(async (req, res) => {
  const sid = schoolOf(req);
  const [[school]] = await pool.query('SELECT school_name, school_code, profile_photo FROM schools WHERE school_id = ?', [sid]);
  const schoolLogo = await SystemSetting.get('school_logo_url', '');
  const [[activeYear]] = await pool.query("SELECT name FROM academic_year WHERE status = 'active' ORDER BY year_id DESC LIMIT 1");
  const [[activeTerm]] = await pool.query("SELECT name FROM term WHERE status = 'active' ORDER BY term_id DESC LIMIT 1");
  const [[classes]] = await pool.query('SELECT COUNT(*) n FROM class WHERE school_id = ?', [sid]);
  const [[teachers]] = await pool.query("SELECT COUNT(*) n FROM teacher WHERE school_id = ? AND status = 'active'", [sid]);
  const [[subjects]] = await pool.query('SELECT COUNT(*) n FROM module WHERE school_id = ?', [sid]);
  const [[students]] = await pool.query("SELECT COUNT(*) n FROM student WHERE school_id = ? AND status = 'active'", [sid]);
  const [[tt]] = await pool.query(
    `SELECT COUNT(*) periods, COUNT(DISTINCT class_id) classes_covered,
            SUM(status = 'published') published, SUM(status = 'draft') drafts
     FROM timetable WHERE school_id = ?`, [sid]);
  const [[rooms]] = await pool.query('SELECT COUNT(*) n FROM room WHERE school_id = ?', [sid]);
  const [[assignments]] = await pool.query('SELECT COUNT(*) n FROM assignment WHERE school_id = ?', [sid]);
  const conflicts = await computeConflicts(sid);

  // Subject distribution (periods per subject) — used for "Subject Performance"
  const [subjectDist] = await pool.query(
    `SELECT module_name name, COUNT(*) periods
     FROM timetable WHERE school_id = ? AND module_name IS NOT NULL AND module_name <> ''
     GROUP BY module_name ORDER BY periods DESC LIMIT 6`, [sid]);

  // Teacher workload (periods per teacher per week)
  const [workload] = await pool.query(
    `SELECT tr.name, COUNT(*) periods
     FROM timetable t JOIN assignment a ON a.assignment_id = t.assignment_id
     JOIN teacher tr ON tr.teacher_id = a.teacher_id
     WHERE t.school_id = ? GROUP BY tr.name ORDER BY periods DESC LIMIT 8`, [sid]);

  // Real academic performance per subject (avg score % + pass rate ≥ 50%)
  const [subjectPerf] = await pool.query(
    `SELECT m.module_name name,
            ROUND(AVG(r.score / r.max_score * 100)) avgScore,
            ROUND(SUM(r.score / r.max_score >= 0.5) / COUNT(*) * 100) passRate,
            COUNT(*) results
     FROM academic_result r JOIN module m ON m.module_id = r.module_id
     WHERE r.school_id = ? GROUP BY m.module_name ORDER BY avgScore DESC LIMIT 6`, [sid]);

  const [recentAssignments] = await pool.query(
    `SELECT a.assignment_id, m.module_name subject, c.class_name className, t.name teacher,
            a.academic_year, a.term, a.created_at
     FROM assignment a
     LEFT JOIN module m ON m.module_id = a.module_id
     LEFT JOIN class c ON c.class_id = a.class_id
     LEFT JOIN teacher t ON t.teacher_id = a.teacher_id
     WHERE a.school_id = ? ORDER BY a.created_at DESC LIMIT 6`, [sid]);

  res.json({
    classes: Number(classes.n || 0),
    teachers: Number(teachers.n || 0),
    subjects: Number(subjects.n || 0),
    students: Number(students.n || 0),
    rooms: Number(rooms.n || 0),
    assignments: Number(assignments.n || 0),
    periods: Number(tt.periods || 0),
    classesCovered: Number(tt.classes_covered || 0),
    publishedPeriods: Number(tt.published || 0),
    draftPeriods: Number(tt.drafts || 0),
    openConflicts: conflicts.length,
    subjectDist, workload, recentAssignments, subjectPerf,
    schoolName: school?.school_name || 'My School',
    schoolCode: school?.school_code || '',
    schoolLogo: schoolLogo || school?.profile_photo || null,
    activeYear: activeYear?.name || null,
    activeTerm: activeTerm?.name || null
  });
}));

// Today's timetable entries (used by dashboard "Timetable Overview")
router.get('/week', asyncH(async (req, res) => {
  const sid = schoolOf(req);
  const [rows] = await pool.query(
    `SELECT t.timetable_id, t.day_of_week, TIME_FORMAT(t.start_time, '%H:%i') start_time,
            TIME_FORMAT(t.end_time, '%H:%i') end_time, t.module_name, t.status,
            c.class_name, tr.name teacher_name, r.room_name
     FROM timetable t
     LEFT JOIN class c ON c.class_id = t.class_id
     LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE t.school_id = ?
     ORDER BY t.day_of_week, t.start_time LIMIT 400`, [sid]);
  res.json({ items: rows });
}));

// School-scoped conflict list
router.get('/conflicts', asyncH(async (req, res) => {
  res.json({ items: await computeConflicts(schoolOf(req)) });
}));

// ---------------------------------------------------------------------------
// Classes with student counts
// ---------------------------------------------------------------------------
router.get('/classes', asyncH(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.class_id, c.class_name, c.level, c.academic_year,
            t.name class_teacher_name, r.room_name,
            (SELECT COUNT(*) FROM student st WHERE st.class_id = c.class_id) student_count
     FROM class c
     LEFT JOIN teacher t ON t.teacher_id = c.class_teacher_id
     LEFT JOIN room r ON r.room_id = c.room_id
     WHERE c.school_id = ? ORDER BY c.class_name`, [schoolOf(req)]);
  res.json({ items: rows });
}));

// ---------------------------------------------------------------------------
// Timetable groups (school-scoped)
// ---------------------------------------------------------------------------
router.get('/groups', asyncH(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT academic_year, term, status, COUNT(*) periods, COUNT(DISTINCT class_id) classes, MIN(created_at) created_at
     FROM timetable WHERE school_id = ? AND academic_year IS NOT NULL AND academic_year <> '' AND term IS NOT NULL AND term <> ''
     GROUP BY academic_year, term, status ORDER BY created_at DESC`, [schoolOf(req)]);
  res.json({ items: rows });
}));

router.get('/entries', asyncH(async (req, res) => {
  const { academic_year, term, class_id = '', teacher_id = '', room_id = '', day = '' } = req.query;
  if (!academic_year || !term) return res.status(400).json({ message: 'academic_year and term are required.' });
  const params = [schoolOf(req), academic_year, term];
  let extra = '';
  if (class_id) { extra += ' AND t.class_id = ?'; params.push(class_id); }
  if (teacher_id) { extra += ' AND a.teacher_id = ?'; params.push(teacher_id); }
  if (room_id) { extra += ' AND t.room_id = ?'; params.push(room_id); }
  if (day) { extra += ' AND t.day_of_week = ?'; params.push(day); }
  const [rows] = await pool.query(
    `SELECT t.timetable_id, t.class_id, t.assignment_id, t.day_of_week,
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

// Publish / archive / draft a group (transactional).
router.put('/group-status', asyncH(async (req, res) => {
  const { academic_year, term, status } = req.body || {};
  if (!academic_year || !term || !['draft', 'published', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'academic_year, term and a valid status are required.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      'UPDATE timetable SET status = ? WHERE school_id = ? AND academic_year = ? AND term = ?',
      [status, schoolOf(req), academic_year, term]);
    if (!r.affectedRows) { await conn.rollback(); return res.status(404).json({ message: 'Timetable group not found.' }); }
    await conn.commit();
    await pool.execute(
      `INSERT INTO activity_logs (school_id, user_id, actor_role, action, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolOf(req), req.user.id, req.user.role, `Timetable ${status}`, 'timetable', `${academic_year} ${term} (${r.affectedRows} periods)`]);
    res.json({ message: `Timetable ${status}.`, affected: r.affectedRows });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// Delete a whole unpublished timetable group (school-scoped).
router.delete('/group', asyncH(async (req, res) => {
  const { academic_year, term } = req.body || {};
  if (!academic_year || !term) {
    return res.status(400).json({ message: 'academic_year and term are required.' });
  }
  const [result] = await pool.execute(
    "DELETE FROM timetable WHERE school_id = ? AND academic_year = ? AND term = ? AND status <> 'published'",
    [schoolOf(req), academic_year, term]
  );
  if (!result.affectedRows) {
    return res.status(404).json({ message: 'No unpublished timetable entries were found for this group.' });
  }
  res.json({ message: 'Unpublished timetable entries deleted.', affected: result.affectedRows });
}));

// Generator (school-scoped, constraint-based, creates DRAFT in a transaction).
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = [
  ['08:00', '08:45'], ['08:50', '09:35'], ['09:50', '10:35'], ['10:40', '11:25'],
  ['11:30', '12:15'], ['13:30', '14:15'], ['14:20', '15:05'], ['15:10', '15:55']
];
router.post('/generate', asyncH(async (req, res) => {
  const sid = schoolOf(req);
  const { academic_year, term, periods_per_class = 24 } = req.body || {};
  if (!academic_year || !term) return res.status(400).json({ message: 'academic_year and term are required.' });
  const [classes] = await pool.query('SELECT class_id, class_name FROM class WHERE school_id = ? ORDER BY class_name', [sid]);
  const [assignments] = await pool.query(
    `SELECT a.assignment_id, a.teacher_id, a.module_id, a.class_id, m.module_name,
            t.available_days, TIME_FORMAT(t.available_from, '%H:%i') available_from, TIME_FORMAT(t.available_to, '%H:%i') available_to
     FROM assignment a
     LEFT JOIN module m ON m.module_id = a.module_id
     LEFT JOIN teacher t ON t.teacher_id = a.teacher_id
     WHERE a.school_id = ?`, [sid]);
  const [rooms] = await pool.query('SELECT room_id, room_name FROM room WHERE school_id = ? ORDER BY room_name', [sid]);
  if (!classes.length || !assignments.length || !rooms.length) {
    return res.status(400).json({ message: 'Your school needs classes, teaching assignments and rooms before a timetable can be generated.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM timetable WHERE school_id = ? AND academic_year = ? AND term = ? AND status = 'draft'", [sid, academic_year, term]);
    const busyTeacher = new Set(); const busyRoom = new Set();
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
        if (asg.available_days && !String(asg.available_days).toLowerCase().includes(day.toLowerCase().slice(0, 3))) continue;
        if (asg.available_from && String(asg.available_from) > start) continue;
        if (asg.available_to && String(asg.available_to) < end) continue;
        if (busyTeacher.has(`${asg.teacher_id}-${key}`) || busyRoom.has(`${room.room_id}-${key}`)) continue;
        busyTeacher.add(`${asg.teacher_id}-${key}`); busyRoom.add(`${room.room_id}-${key}`);
        await conn.execute(
          `INSERT INTO timetable (class_id, assignment_id, day_of_week, start_time, end_time, room_id, module_name, school_id, status, academic_year, term)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [cls.class_id, asg.assignment_id, day, start, end, room.room_id, asg.module_name, sid, academic_year, term]);
        created++; placed++;
      }
    }
    await conn.commit();
    await pool.execute(
      'INSERT INTO activity_logs (school_id, user_id, actor_role, action, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)',
      [sid, req.user.id, req.user.role, 'Generated timetable draft', 'timetable', `${academic_year} ${term} — ${created} periods`]);
    res.status(201).json({ message: `Draft timetable generated with ${created} periods.`, created });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// ---------------------------------------------------------------------------
// Audit trail (school-scoped)
// ---------------------------------------------------------------------------
router.get('/activity', asyncH(async (req, res) => {
  const { q = '', limit = 100 } = req.query;
  const params = [schoolOf(req)];
  let where = 'WHERE a.school_id = ?';
  if (q) { where += ' AND (a.action LIKE ? OR a.message LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  const [rows] = await pool.query(
    `SELECT a.activity_id, a.action, a.entity_type, a.message, a.actor_role, a.created_at,
            COALESCE(u.full_name, u.username, 'System') actor
     FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
     ${where} ORDER BY a.created_at DESC LIMIT ?`, [...params, Math.min(Number(limit) || 100, 300)]);
  res.json({ items: rows });
}));

// ---------------------------------------------------------------------------
// Scheduling constraints (per school)
// ---------------------------------------------------------------------------
router.get('/constraints', asyncH(async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM school_constraint WHERE school_id = ?', [schoolOf(req)]);
  res.json(row || { max_periods_per_day: 8, max_consecutive_periods: 3, max_teacher_periods_per_day: 6, allow_saturday: 0 });
}));

router.put('/constraints', asyncH(async (req, res) => {
  const { max_periods_per_day = 8, max_consecutive_periods = 3, max_teacher_periods_per_day = 6, allow_saturday = 0 } = req.body || {};
  await pool.query(
    `INSERT INTO school_constraint (school_id, max_periods_per_day, max_consecutive_periods, max_teacher_periods_per_day, allow_saturday)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE max_periods_per_day = VALUES(max_periods_per_day),
       max_consecutive_periods = VALUES(max_consecutive_periods),
       max_teacher_periods_per_day = VALUES(max_teacher_periods_per_day),
       allow_saturday = VALUES(allow_saturday)`,
    [schoolOf(req), max_periods_per_day, max_consecutive_periods, max_teacher_periods_per_day, allow_saturday ? 1 : 0]);
  res.json({ message: 'Constraints saved.' });
}));

// ---------------------------------------------------------------------------
// Teachers CRUD + availability (school-scoped)
// ---------------------------------------------------------------------------
const bcrypt = require('bcryptjs');

router.post('/teachers', asyncH(async (req, res) => {
  const { name, email, phone = null, department = null, qualification = null, gender = null, date_joined = null } = req.body || {};
  if (!name || name.trim().length < 3) return res.status(400).json({ message: 'Full name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ message: 'A valid email is required.' });
  const [dup] = await pool.execute('SELECT teacher_id FROM teacher WHERE LOWER(email) = LOWER(?)', [email]);
  if (dup.length) return res.status(409).json({ message: 'A teacher with this email already exists.' });
  const [[maxStaff]] = await pool.query('SELECT COUNT(*) n FROM teacher WHERE school_id = ?', [schoolOf(req)]);
  const employeeId = `EMP-${schoolOf(req)}${String(maxStaff.n + 101).padStart(3, '0')}`;
  const staffId = `STF-${schoolOf(req)}${String(maxStaff.n + 101).padStart(3, '0')}`;
  const hash = await bcrypt.hash('Panta@123', 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [t] = await conn.execute(
      `INSERT INTO teacher (name, email, password, department, status, date_joined, school_id, phone, qualification, gender, employee_id, staff_id)
       VALUES (?, ?, ?, ?, 'active', COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?)`,
      [name.trim(), email, hash, department, date_joined, schoolOf(req), phone, qualification, gender, employeeId, staffId]);
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 90);
    await conn.execute(
      `INSERT INTO users (username, email, full_name, password, password_hash, role, school_id, phone, status, is_verified)
       VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?, 'active', 1) ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [username, email, name.trim(), hash, hash, schoolOf(req), phone]);
    await conn.commit();
    res.status(201).json({ message: 'Teacher created with a temporary password (Panta@123).', id: t.insertId, employee_id: employeeId });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.put('/teachers/:id', asyncH(async (req, res) => {
  const { name, department, phone, status, qualification, gender, date_joined } = req.body || {};
  const [r] = await pool.execute(
    `UPDATE teacher SET name = COALESCE(?, name), department = COALESCE(?, department),
       phone = COALESCE(?, phone), status = COALESCE(?, status),
       qualification = COALESCE(?, qualification), gender = COALESCE(?, gender), date_joined = COALESCE(?, date_joined)
     WHERE teacher_id = ? AND school_id = ?`,
    [name || null, department || null, phone || null,
     ['active', 'pending', 'disabled', 'suspended'].includes(status) ? status : null,
     qualification || null, gender || null, date_joined || null, req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Teacher not found in your school.' });
  res.json({ message: 'Teacher updated.' });
}));

router.put('/teachers/:id/availability', asyncH(async (req, res) => {
  const { available_days = null, available_from = null, available_to = null } = req.body || {};
  const [r] = await pool.execute(
    `UPDATE teacher SET available_days = ?, available_from = ?, available_to = ? WHERE teacher_id = ? AND school_id = ?`,
    [available_days, available_from, available_to, req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Teacher not found in your school.' });
  res.json({ message: 'Availability updated.' });
}));

router.delete('/teachers/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT assignment_id FROM assignment WHERE teacher_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This teacher has teaching assignments. Remove those first or suspend the teacher instead.' });
  const [r] = await pool.execute('DELETE FROM teacher WHERE teacher_id = ? AND school_id = ?', [req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Teacher not found in your school.' });
  res.json({ message: 'Teacher deleted.' });
}));

// ---------------------------------------------------------------------------
// Classes CRUD + roster management (school-scoped)
// ---------------------------------------------------------------------------
router.post('/classes', asyncH(async (req, res) => {
  const { class_name, level = null, academic_year = null, class_teacher_id = null, room_id = null } = req.body || {};
  if (!class_name || class_name.trim().length < 2) return res.status(400).json({ message: 'Class name is required.' });
  const [dup] = await pool.execute('SELECT class_id FROM class WHERE LOWER(class_name) = LOWER(?) AND school_id = ?', [class_name, schoolOf(req)]);
  if (dup.length) return res.status(409).json({ message: 'This class already exists in your school.' });
  const [r] = await pool.execute(
    'INSERT INTO class (class_name, level, academic_year, school_id, class_teacher_id, room_id) VALUES (?, ?, ?, ?, ?, ?)',
    [class_name.trim(), level, academic_year, schoolOf(req), class_teacher_id, room_id]);
  res.status(201).json({ message: 'Class created.', id: r.insertId });
}));

router.put('/classes/:id', asyncH(async (req, res) => {
  const { class_name, level, academic_year, class_teacher_id, room_id } = req.body || {};
  const [r] = await pool.execute(
    `UPDATE class SET class_name = COALESCE(?, class_name), level = COALESCE(?, level),
       academic_year = COALESCE(?, academic_year), class_teacher_id = COALESCE(?, class_teacher_id), room_id = COALESCE(?, room_id)
     WHERE class_id = ? AND school_id = ?`,
    [class_name || null, level || null, academic_year || null, class_teacher_id || null, room_id || null, req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Class not found in your school.' });
  res.json({ message: 'Class updated.' });
}));

router.delete('/classes/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT timetable_id FROM timetable WHERE class_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This class has timetable entries and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM class WHERE class_id = ? AND school_id = ?', [req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Class not found in your school.' });
  res.json({ message: 'Class deleted.' });
}));

// Roster: list students of a class
router.get('/classes/:id/students', asyncH(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT student_id, student_number, name, email, sex, status, class_id FROM student
     WHERE class_id = ? AND school_id = ? ORDER BY name`, [req.params.id, schoolOf(req)]);
  res.json({ items: rows });
}));

// Unassigned students of the school (for enrollment picker)
router.get('/students/unassigned', asyncH(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT student_id, student_number, name, email, status FROM student
     WHERE school_id = ? AND (class_id IS NULL OR class_id = 0) AND status = 'active' ORDER BY name LIMIT 200`, [schoolOf(req)]);
  res.json({ items: rows });
}));

// Enroll / transfer a student into a class
router.put('/students/:id/enroll', asyncH(async (req, res) => {
  const { class_id } = req.body || {};
  if (!class_id) return res.status(400).json({ message: 'class_id is required.' });
  const [[cls]] = await pool.query('SELECT class_id FROM class WHERE class_id = ? AND school_id = ?', [class_id, schoolOf(req)]);
  if (!cls) return res.status(404).json({ message: 'Class not found in your school.' });
  const [r] = await pool.execute('UPDATE student SET class_id = ? WHERE student_id = ? AND school_id = ?', [class_id, req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Student not found in your school.' });
  res.json({ message: 'Student enrolled.' });
}));

// Remove a student from a class
router.put('/students/:id/unenroll', asyncH(async (req, res) => {
  const [r] = await pool.execute('UPDATE student SET class_id = NULL WHERE student_id = ? AND school_id = ?', [req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Student not found in your school.' });
  res.json({ message: 'Student removed from class.' });
}));

// ---------------------------------------------------------------------------
// Subjects CRUD (school-scoped modules)
// ---------------------------------------------------------------------------
router.post('/subjects', asyncH(async (req, res) => {
  const { module_name, department = null, hours_per_year = 0 } = req.body || {};
  if (!module_name || module_name.trim().length < 2) return res.status(400).json({ message: 'Subject name is required.' });
  const [dup] = await pool.execute('SELECT module_id FROM module WHERE LOWER(module_name) = LOWER(?) AND school_id = ?', [module_name, schoolOf(req)]);
  if (dup.length) return res.status(409).json({ message: 'This subject already exists in your school.' });
  const [r] = await pool.execute('INSERT INTO module (module_name, department, hours_per_year, school_id) VALUES (?, ?, ?, ?)',
    [module_name.trim(), department, hours_per_year ?? 0, schoolOf(req)]);
  res.status(201).json({ message: 'Subject created.', id: r.insertId });
}));

router.put('/subjects/:id', asyncH(async (req, res) => {
  const { module_name, department, hours_per_year } = req.body || {};
  const [r] = await pool.execute(
    'UPDATE module SET module_name = COALESCE(?, module_name), department = COALESCE(?, department), hours_per_year = COALESCE(?, hours_per_year) WHERE module_id = ? AND school_id = ?',
    [module_name || null, department || null, hours_per_year ?? null, req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Subject not found in your school.' });
  res.json({ message: 'Subject updated.' });
}));

router.delete('/subjects/:id', asyncH(async (req, res) => {
  const [used] = await pool.execute('SELECT assignment_id FROM assignment WHERE module_id = ? LIMIT 1', [req.params.id]);
  if (used.length) return res.status(409).json({ message: 'This subject is used by teaching assignments and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM module WHERE module_id = ? AND school_id = ?', [req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Subject not found in your school.' });
  res.json({ message: 'Subject deleted.' });
}));

// ---------------------------------------------------------------------------
// Manual timetable override: move a DRAFT entry with conflict validation
// ---------------------------------------------------------------------------
router.put('/entries/:id/move', asyncH(async (req, res) => {
  const { day_of_week, start_time, end_time, room_id } = req.body || {};
  const [[cur]] = await pool.query(
    `SELECT t.*, a.teacher_id FROM timetable t LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     WHERE t.timetable_id = ? AND t.school_id = ?`, [req.params.id, schoolOf(req)]);
  if (!cur) return res.status(404).json({ message: 'Entry not found in your school.' });
  // Published entries may be moved to resolve conflicts — the change is audited.
  const next = {
    day_of_week: day_of_week || cur.day_of_week,
    start_time: start_time || String(cur.start_time).slice(0, 5),
    end_time: end_time || String(cur.end_time).slice(0, 5),
    room_id: room_id !== undefined ? room_id : cur.room_id
  };
  if (next.end_time <= next.start_time) return res.status(400).json({ message: 'End time must be after start time.' });
  const [rows] = await pool.query(
    `SELECT t.timetable_id, t.class_id, t.room_id, a.teacher_id, c.class_name, tr.name teacher_name, r.room_name
     FROM timetable t
     LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN class c ON c.class_id = t.class_id
     LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE t.school_id = ? AND t.day_of_week = ? AND t.start_time < ? AND t.end_time > ? AND t.timetable_id <> ?`,
    [schoolOf(req), next.day_of_week, next.end_time, next.start_time, cur.timetable_id]);
  for (const r of rows) {
    if (cur.teacher_id && r.teacher_id === cur.teacher_id && r.class_id !== cur.class_id) {
      return res.status(409).json({ code: 'TIMETABLE_CONFLICT', message: `Cannot move: ${r.teacher_name || 'The teacher'} is already teaching ${r.class_name} at that time.` });
    }
    if (r.class_id === cur.class_id) {
      return res.status(409).json({ code: 'TIMETABLE_CONFLICT', message: `Cannot move: ${r.class_name} already has a lesson at that time.` });
    }
    if (next.room_id && r.room_id === Number(next.room_id)) {
      return res.status(409).json({ code: 'TIMETABLE_CONFLICT', message: `Cannot move: ${r.room_name || 'The room'} is already booked at that time.` });
    }
  }
  await pool.execute('UPDATE timetable SET day_of_week = ?, start_time = ?, end_time = ?, room_id = ? WHERE timetable_id = ?',
    [next.day_of_week, next.start_time, next.end_time, next.room_id, cur.timetable_id]);
  await pool.execute(
    `INSERT INTO activity_logs (school_id, user_id, actor_role, action, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [schoolOf(req), req.user.id, req.user.role, cur.status === 'published' ? 'Resolved timetable conflict' : 'Moved timetable entry', 'timetable', cur.timetable_id,
     `${cur.day_of_week} ${String(cur.start_time).slice(0, 5)} → ${next.day_of_week} ${next.start_time}`]);
  res.json({ message: 'Lesson moved.' });
}));

// Suggest conflict-free alternative slots for an entry (auto-resolve assistant).
router.get('/entries/:id/suggestions', asyncH(async (req, res) => {
  const [[cur]] = await pool.query(
    `SELECT t.*, a.teacher_id FROM timetable t LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     WHERE t.timetable_id = ? AND t.school_id = ?`, [req.params.id, schoolOf(req)]);
  if (!cur) return res.status(404).json({ message: 'Entry not found in your school.' });

  const [rows] = await pool.query(
    `SELECT t.class_id, t.room_id, t.day_of_week, t.start_time, t.end_time, a.teacher_id
     FROM timetable t LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     WHERE t.school_id = ? AND t.timetable_id <> ?`, [schoolOf(req), cur.timetable_id]);
  const busyTeacher = new Set(); const busyClass = new Set()
  const roomBusy = new Map() // key -> Set(room_id)
  rows.forEach((r) => {
    const key = `${r.day_of_week}|${String(r.start_time).slice(0, 5)}`
    if (r.teacher_id === cur.teacher_id) busyTeacher.add(key)
    if (r.class_id === cur.class_id) busyClass.add(key)
    if (r.room_id) {
      if (!roomBusy.has(key)) roomBusy.set(key, new Set())
      roomBusy.get(key).add(r.room_id)
    }
  })
  const [rooms] = await pool.query('SELECT room_id FROM room WHERE school_id = ? ORDER BY room_name', [schoolOf(req)])

  const suggestions = []
  for (const day of DAYS) {
    for (const [start, end] of SLOTS) {
      const key = `${day}|${start}`
      if (busyTeacher.has(key) || busyClass.has(key)) continue
      const usedRooms = roomBusy.get(key)
      const freeRoom = rooms.find((r) => !usedRooms || !usedRooms.has(r.room_id))
      if (!freeRoom) continue
      suggestions.push({ day_of_week: day, start_time: start, end_time: end, room_id: freeRoom.room_id })
      if (suggestions.length >= 6) break
    }
    if (suggestions.length >= 6) break
  }
  res.json({ entry: { timetable_id: cur.timetable_id, day_of_week: cur.day_of_week, start_time: String(cur.start_time).slice(0, 5), end_time: String(cur.end_time).slice(0, 5) }, suggestions })
}));

router.delete('/entries/:id', asyncH(async (req, res) => {
  const [r] = await pool.execute(
    "DELETE FROM timetable WHERE timetable_id = ? AND school_id = ? AND status <> 'published'",
    [req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Entry not found or locked (published timetables cannot be edited).' });
  res.json({ message: 'Entry deleted.' });
}));

// ---------------------------------------------------------------------------
// School announcements (DOS composer; students/teachers read them)
// ---------------------------------------------------------------------------
router.get('/announcements', asyncH(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.announcement_id, a.title, a.message, a.priority, a.created_at
     FROM announcements a JOIN announcement_targets t ON t.announcement_id = a.announcement_id
     WHERE t.school_id = ? ORDER BY a.created_at DESC LIMIT 50`, [schoolOf(req)]);
  res.json({ items: rows });
}));

router.post('/announcements', asyncH(async (req, res) => {
  const { title, message, priority = 'Normal' } = req.body || {};
  if (!title || title.trim().length < 3) return res.status(400).json({ message: 'Title is required (3+ characters).' });
  if (!message || message.trim().length < 5) return res.status(400).json({ message: 'Message is required (5+ characters).' });
  if (!['Normal', 'Important', 'Urgent'].includes(priority)) return res.status(400).json({ message: 'Invalid priority.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      'INSERT INTO announcements (title, message, priority, created_by) VALUES (?, ?, ?, ?)',
      [title.trim(), message.trim(), priority, req.user.id]);
    await conn.execute('INSERT INTO announcement_targets (announcement_id, school_id) VALUES (?, ?)', [r.insertId, schoolOf(req)]);
    await conn.execute(
      'INSERT INTO activity_logs (school_id, user_id, actor_role, action, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [schoolOf(req), req.user.id, req.user.role, 'Posted announcement', 'announcement', r.insertId, title.trim()]);
    await conn.commit();
    res.status(201).json({ message: 'Announcement posted to your school.', id: r.insertId });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.delete('/announcements/:id', asyncH(async (req, res) => {
  const [r] = await pool.execute(
    `DELETE a, t FROM announcements a JOIN announcement_targets t ON t.announcement_id = a.announcement_id
     WHERE a.announcement_id = ? AND t.school_id = ?`, [req.params.id, schoolOf(req)]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Announcement not found in your school.' });
  res.json({ message: 'Announcement deleted.' });
}));

module.exports = router;
