// ============================================================================
// PANTA Teacher console API (/api/teacher-console)
// Serves the authenticated teacher's own data only (resolved from the token,
// never from client-supplied ids). Mounted behind the shared `auth` middleware
// and restricted to role = teacher.
// ============================================================================

const express = require('express');
const pool = require('../config/database');
const SystemSetting = require('../models/SystemSetting');

const router = express.Router();

const asyncH = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(`[teacher-console] ${req.method} ${req.path} failed:`, e);
  res.status(500).json({ message: 'Server error. Please try again.' });
});

// Resolve the teacher row from the authenticated principal.
const teacherOf = async (req) => {
  const email = req.user?.email || req.teacher?.email;
  if (!email) return null;
  const [[t]] = await pool.query('SELECT * FROM teacher WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
  return t || null;
};

const schoolContext = async (schoolId) => {
  const [[school]] = await pool.query('SELECT school_name, profile_photo FROM schools WHERE school_id = ?', [schoolId]);
  const [[activeYear]] = await pool.query("SELECT name FROM academic_year WHERE status = 'active' ORDER BY year_id DESC LIMIT 1");
  const [[activeTerm]] = await pool.query("SELECT name FROM term WHERE status = 'active' ORDER BY term_id DESC LIMIT 1");
  const schoolLogo = await SystemSetting.get('school_logo_url', '');
  return {
    schoolName: school?.school_name || 'My School',
    schoolLogo: schoolLogo || school?.profile_photo || null,
    activeYear: activeYear?.name || null,
    activeTerm: activeTerm?.name || null
  }
};

router.get('/overview', asyncH(async (req, res) => {
  const teacher = await teacherOf(req);
  if (!teacher) return res.status(404).json({ message: 'Teacher profile not found.' });
  const tid = teacher.teacher_id;

  const [myClasses] = await pool.query(
    'SELECT DISTINCT c.class_id, c.class_name FROM assignment a JOIN class c ON c.class_id = a.class_id WHERE a.teacher_id = ?', [tid]);
  const [mySubjects] = await pool.query(
    'SELECT DISTINCT m.module_id, m.module_name FROM assignment a JOIN module m ON m.module_id = a.module_id WHERE a.teacher_id = ?', [tid]);
  const [[students]] = await pool.query(
    `SELECT COUNT(*) n FROM student WHERE class_id IN
       (SELECT DISTINCT class_id FROM assignment WHERE teacher_id = ?) AND status = 'active'`, [tid]);
  const [[att]] = await pool.query(
    `SELECT SUM(status = 'present') present, COUNT(*) total FROM student_attendance
     WHERE teacher_id = ? AND attendance_date >= CURDATE() - INTERVAL 7 DAY`, [tid]);
  const [today] = await pool.query(
    `SELECT t.timetable_id, TIME_FORMAT(t.start_time, '%H:%i') start_time, TIME_FORMAT(t.end_time, '%H:%i') end_time,
            t.module_name, c.class_name, r.room_name
     FROM timetable t
     JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN class c ON c.class_id = t.class_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE a.teacher_id = ? AND t.day_of_week = DAYNAME(CURDATE()) AND t.status = 'published'
     ORDER BY t.start_time`, [tid]);
  const [week] = await pool.query(
    `SELECT t.timetable_id, t.day_of_week, TIME_FORMAT(t.start_time, '%H:%i') start_time, TIME_FORMAT(t.end_time, '%H:%i') end_time,
            t.module_name, c.class_name, r.room_name
     FROM timetable t
     JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN class c ON c.class_id = t.class_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE a.teacher_id = ? AND t.status = 'published'
     ORDER BY FIELD(t.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), t.start_time`, [tid]);
  const [recentActivity] = await pool.query(
    `SELECT action, message, created_at FROM activity_logs
     WHERE school_id = ? ORDER BY created_at DESC LIMIT 6`, [teacher.school_id]);

  const [announcements] = await pool.query(
    `SELECT a.announcement_id, a.title, a.message AS content, a.priority, a.created_at
     FROM announcements a
     LEFT JOIN announcement_targets t ON t.announcement_id = a.announcement_id
     WHERE t.school_id = ? OR a.announcement_id NOT IN (SELECT announcement_id FROM announcement_targets)
     GROUP BY a.announcement_id ORDER BY a.created_at DESC LIMIT 5`, [teacher.school_id]).catch(() => [[]]);

  const attendanceRate = att.total ? Math.round((Number(att.present || 0) / Number(att.total)) * 100) : null;
  const ctx = await schoolContext(teacher.school_id);

  res.json({
    teacher: { id: tid, name: teacher.name, email: teacher.email, department: teacher.department, schoolId: teacher.school_id },
    classes: myClasses.length, classList: myClasses,
    subjects: mySubjects.length, subjectList: mySubjects,
    students: Number(students.n || 0),
    attendanceRate,
    today, week,
    weeklyPeriods: week.length,
    recentActivity,
    announcements,
    schoolName: ctx.schoolName,
    schoolLogo: ctx.schoolLogo,
    activeYear: ctx.activeYear,
    activeTerm: ctx.activeTerm
  });
}));

// ---------------------------------------------------------------------------
// Academic results — teachers enter scores for THEIR assigned subject+class
// ---------------------------------------------------------------------------
router.get('/results', asyncH(async (req, res) => {
  const teacher = await teacherOf(req);
  if (!teacher) return res.status(404).json({ message: 'Teacher profile not found.' });
  const { class_id, module_id, assessment, term, academic_year } = req.query;
  if (!class_id || !module_id || !assessment) return res.status(400).json({ message: 'class_id, module_id and assessment are required.' });

  // Ownership: teacher must have an assignment for this module+class
  const [[own]] = await pool.query(
    'SELECT assignment_id FROM assignment WHERE teacher_id = ? AND module_id = ? AND class_id = ? LIMIT 1',
    [teacher.teacher_id, module_id, class_id]);
  if (!own) return res.status(403).json({ message: 'You are not assigned to teach this subject to this class.' });

  const [students] = await pool.query(
    'SELECT student_id, student_number, name FROM student WHERE class_id = ? ORDER BY name', [class_id]);
  const [results] = await pool.query(
    `SELECT student_id, score, max_score FROM academic_result
     WHERE class_id = ? AND module_id = ? AND assessment = ? AND term = ? AND academic_year = ?`,
    [class_id, module_id, assessment, term || 'Term 1', academic_year || '2026/2027']);
  res.json({ students, results });
}));

router.post('/results', asyncH(async (req, res) => {
  const teacher = await teacherOf(req);
  if (!teacher) return res.status(404).json({ message: 'Teacher profile not found.' });
  const { class_id, module_id, assessment, term = 'Term 1', academic_year = '2026/2027', max_score = 100, records } = req.body || {};
  if (!class_id || !module_id || !assessment || !Array.isArray(records) || !records.length) {
    return res.status(400).json({ message: 'class_id, module_id, assessment and records are required.' });
  }
  if (Number(max_score) <= 0 || Number(max_score) > 1000) return res.status(400).json({ message: 'Invalid maximum score.' });

  const [[own]] = await pool.query(
    'SELECT assignment_id FROM assignment WHERE teacher_id = ? AND module_id = ? AND class_id = ? LIMIT 1',
    [teacher.teacher_id, module_id, class_id]);
  if (!own) return res.status(403).json({ message: 'You are not assigned to teach this subject to this class.' });

  for (const r of records) {
    const score = Number(r.score)
    if (Number.isNaN(score) || score < 0 || score > Number(max_score)) {
      return res.status(400).json({ message: `Score for a student must be between 0 and ${max_score}.` });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of records) {
      await conn.execute(
        `INSERT INTO academic_result (student_id, module_id, class_id, teacher_id, assessment, score, max_score, term, academic_year, school_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), max_score = VALUES(max_score), teacher_id = VALUES(teacher_id)`,
        [r.student_id, module_id, class_id, teacher.teacher_id, assessment, r.score, max_score, term, academic_year, teacher.school_id]);
    }
    await conn.commit();
    res.json({ message: `Results saved for ${records.length} students.`, count: records.length });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

module.exports = router;
