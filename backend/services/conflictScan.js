// Shared timetable conflict scanner (teacher / room / class double-booking).
const pool = require('../config/database');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const normTime = (t) => String(t || '').slice(0, 5);
const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;

const computeConflicts = async (schoolId = null) => {
  const params = [];
  let where = "t.status = 'published'";
  if (schoolId) { where += ' AND t.school_id = ?'; params.push(schoolId); }
  const [rows] = await pool.execute(
    `SELECT t.timetable_id, t.school_id, t.class_id, t.room_id, t.day_of_week, t.start_time, t.end_time,
            t.module_name, a.teacher_id, tr.name AS teacher_name, c.class_name, r.room_name, s.school_name
     FROM timetable t
     LEFT JOIN assignment a ON a.assignment_id = t.assignment_id
     LEFT JOIN teacher tr ON tr.teacher_id = a.teacher_id
     LEFT JOIN class c ON c.class_id = t.class_id
     LEFT JOIN room r ON r.room_id = t.room_id
     LEFT JOIN schools s ON s.school_id = t.school_id
     WHERE ${where}
     ORDER BY t.school_id, t.day_of_week, t.start_time`, params);

  const conflicts = [];
  const buckets = new Map();
  rows.forEach((r) => {
    const key = `${r.school_id}|${r.day_of_week}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  });
  buckets.forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        if (!overlaps(normTime(a.start_time), normTime(a.end_time), normTime(b.start_time), normTime(b.end_time))) continue;
        const push = (type, detail) => conflicts.push({
          key: `${type}:${[a.timetable_id, b.timetable_id].sort((x, y) => x - y).join(':')}`,
          type, title: `${type[0].toUpperCase() + type.slice(1)} conflict`, detail,
          day: DAYS.indexOf(a.day_of_week), start: normTime(a.start_time), end: normTime(a.end_time),
          schoolId: a.school_id, schoolName: a.school_name || 'Unknown school',
          entryIds: [a.timetable_id, b.timetable_id]
        });
        if (a.teacher_id && a.teacher_id === b.teacher_id && a.class_id !== b.class_id) {
          push('teacher', `${a.teacher_name || 'A teacher'} is assigned to ${a.class_name} and ${b.class_name} at ${normTime(a.start_time)} on ${a.day_of_week}.`);
        } else if (a.room_id && a.room_id === b.room_id && a.class_id !== b.class_id) {
          push('room', `${a.room_name || 'A room'} is booked for ${a.class_name} and ${b.class_name} at ${normTime(a.start_time)} on ${a.day_of_week}.`);
        } else if (a.class_id === b.class_id && a.module_name !== b.module_name) {
          push('class', `${a.class_name} has two subjects (${a.module_name}, ${b.module_name}) at ${normTime(a.start_time)} on ${a.day_of_week}.`);
        }
      }
    }
  });
  const seen = new Set();
  return conflicts.filter((c) => !seen.has(c.key) && seen.add(c.key));
};

module.exports = { computeConflicts };
