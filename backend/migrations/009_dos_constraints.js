// 009 — Per-school scheduling constraints used by the DOS timetable engine.
const pool = require('../config/database');

const up = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS school_constraint (
      constraint_id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT NOT NULL,
      max_periods_per_day INT NOT NULL DEFAULT 8,
      max_consecutive_periods INT NOT NULL DEFAULT 3,
      max_teacher_periods_per_day INT NOT NULL DEFAULT 6,
      allow_saturday TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_constraint_school (school_id)
    )
  `);
};

module.exports = { up };
