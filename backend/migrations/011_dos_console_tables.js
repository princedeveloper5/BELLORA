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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      announcement_id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      priority ENUM('Normal', 'Important', 'Urgent') NOT NULL DEFAULT 'Normal',
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_targets (
      target_id INT AUTO_INCREMENT PRIMARY KEY,
      announcement_id INT NOT NULL,
      school_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_announcement_school (announcement_id, school_id),
      INDEX idx_announcement_targets_announcement (announcement_id),
      INDEX idx_announcement_targets_school (school_id)
    )
  `);
};

module.exports = { up };
