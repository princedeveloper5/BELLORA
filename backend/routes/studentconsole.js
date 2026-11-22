// ============================================================================
// BELLORA Student console API (/api/student-console)
// Serves the authenticated student's own data only (resolved from the JWT
// user id, never from client-supplied ids). Students are read-only here.
// ============================================================================

const express = require('express');
const pool = require('../config/database');
const SystemSetting = require('../models/SystemSetting');

const router = express.Router();

const asyncH = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(`[student-console] ${req.method} ${req.path} failed:`, e);
  res.status(500).json({ message: 'Server error. Please try again.' });
});

const studentOf = async (req) => {
  const userId = req.user?.id || req.user?.userId;
  if (!userId) return null;
  const [[s]] = await pool.query('SELECT * FROM student WHERE user_id = ? LIMIT 1', [userId]);
  return s || null;
};

router.get('/overview', asyncH(async (req, res) => {
  const student = await studentOf(req);
  if (!student) return res.status(404).json({ message: 'Student profile not found.' });
  const sid = student.school_id;

  const [[cls]] = await pool.query(
    `SELECT c.class_id, c.class_name, c.level, c.academic_year, t.name class_teacher, r.room_name
     FROM class c LEFT JOIN teacher t ON t.teacher_id = c.class_teacher_id
     LEFT JOIN room r ON r.room_id = c.room_id WHERE c.class_id = ?`, [student.class_id || 0]);

  const [subjects] = student.class_id ? await pool.query(
    `SELECT DISTINCT m.module_id, m.module_name, m.department, t.name teacher_name
     FROM assignment a
     JOIN module m ON m.module_id = a.module_id
     LEFT JOIN teacher t ON t.teacher_id = a.teacher_id
     WHERE a.class_id = ?`, [student.class_id]) : [[]];

  const [today] = student.class_id ? await pool.query(
    `SELECT t.timetable_id, TIME_FORMAT(t.start_time, '%H:%i') start_time, TIME_FORMAT(t.end_time, '%H:%i') end_time,
            t.module_name, tr.name teacher_name, r.room_name
     FROM timetable t
     LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE t.class_id = ? AND t.day_of_week = DAYNAME(CURDATE()) AND t.status = 'published'
     ORDER BY t.start_time`, [student.class_id]) : [[]];

  const [week] = student.class_id ? await pool.query(
    `SELECT t.timetable_id, t.day_of_week, TIME_FORMAT(t.start_time, '%H:%i') start_time, TIME_FORMAT(t.end_time, '%H:%i') end_time,
            t.module_name, tr.name teacher_name, r.room_name
     FROM timetable t
     LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
     LEFT JOIN room r ON r.room_id = t.room_id
     WHERE t.class_id = ? AND t.status = 'published'
     ORDER BY FIELD(t.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), t.start_time`, [student.class_id]) : [[]];

  const [[att]] = await pool.query(
    `SELECT SUM(status = 'present') present, SUM(status = 'late') late, SUM(status = 'absent') absent, SUM(status = 'excused') excused, COUNT(*) total
     FROM student_attendance WHERE student_id = ?`, [student.student_id]);
  const [attRecent] = await pool.query(
    `SELECT attendance_date, period_label, status, notes FROM student_attendance
     WHERE student_id = ? ORDER BY attendance_date DESC LIMIT 10`, [student.student_id]);

  const applicable = Number(att.total || 0) - Number(att.excused || 0);
  const attendanceRate = applicable ? Math.round(((Number(att.present || 0) + Number(att.late || 0) * 0.5) / applicable) * 100) : null;

  const nextLesson = today.find((l) => l.start_time > new Date().toTimeString().slice(0, 5)) || null;

  const [results] = await pool.query(
    `SELECT r.module_id, m.module_name, r.assessment, r.score, r.max_score, r.term, r.academic_year, r.updated_at
     FROM academic_result r JOIN module m ON m.module_id = r.module_id
     WHERE r.student_id = ? ORDER BY r.updated_at DESC LIMIT 60`, [student.student_id]);

  const [[school]] = await pool.query('SELECT school_name, school_code, profile_photo FROM schools WHERE school_id = ?', [sid]);
  const [[activeYear]] = await pool.query("SELECT name FROM academic_year WHERE status = 'active' ORDER BY year_id DESC LIMIT 1");
  const [[activeTerm]] = await pool.query("SELECT name FROM term WHERE status = 'active' ORDER BY term_id DESC LIMIT 1");
  const schoolLogo = await SystemSetting.get('school_logo_url', '');

  const [announcements] = await pool.query(
    `SELECT a.announcement_id, a.title, a.message AS content, a.priority, a.created_at
     FROM announcements a
     LEFT JOIN announcement_targets t ON t.announcement_id = a.announcement_id
     WHERE t.school_id = ? OR a.announcement_id NOT IN (SELECT announcement_id FROM announcement_targets)
     GROUP BY a.announcement_id
     ORDER BY a.created_at DESC LIMIT 5`, [sid]).catch(() => [[]]);

  res.json({
    student: {
      id: student.student_id, name: student.name, email: student.email,
      studentNumber: student.student_number, sex: student.sex, status: student.status
    },
    class: cls || null,
    subjects,
    today, week, nextLesson,
    weeklyPeriods: week.length,
    attendance: {
      rate: attendanceRate,
      present: Number(att.present || 0), absent: Number(att.absent || 0),
      late: Number(att.late || 0), excused: Number(att.excused || 0),
      recent: attRecent
    },
    results,
    announcements,
    schoolName: school?.school_name || 'My School',
    schoolCode: school?.school_code || '',
    schoolLogo: schoolLogo || school?.profile_photo || null,
    activeYear: activeYear?.name || null,
    activeTerm: activeTerm?.name || null
  });
}));

module.exports = router;
