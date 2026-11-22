// 008 — Super Admin platform structures: academic years, terms, departments.
// school_id IS NULL means the record is platform-global (shared by all schools).
const pool = require('../config/database');

const up = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academic_year (
      year_id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT NULL,
      name VARCHAR(40) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('active','upcoming','archived') NOT NULL DEFAULT 'upcoming',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_year_school (school_id),
      INDEX idx_year_status (status)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS term (
      term_id INT AUTO_INCREMENT PRIMARY KEY,
      year_id INT NOT NULL,
      school_id INT NULL,
      name VARCHAR(60) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('active','upcoming','archived') NOT NULL DEFAULT 'upcoming',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_term_year (year_id),
      INDEX idx_term_school (school_id),
      CONSTRAINT fk_term_year FOREIGN KEY (year_id) REFERENCES academic_year(year_id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS department (
      department_id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT NULL,
      name VARCHAR(120) NOT NULL,
      head VARCHAR(160) NULL,
      status ENUM('active','archived') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_department_school (school_id)
    )
  `);

  // Seed a sensible global academic calendar if empty
  const [years] = await pool.query('SELECT year_id FROM academic_year LIMIT 1');
  if (!years.length) {
    const [r1] = await pool.query(
      `INSERT INTO academic_year (school_id, name, start_date, end_date, status) VALUES (NULL, '2024/2025', '2024-09-09', '2025-07-04', 'archived')`
    );
    const [r2] = await pool.query(
      `INSERT INTO academic_year (school_id, name, start_date, end_date, status) VALUES (NULL, '2025/2026', '2025-09-08', '2026-07-03', 'archived')`
    );
    const [r3] = await pool.query(
      `INSERT INTO academic_year (school_id, name, start_date, end_date, status) VALUES (NULL, '2026/2027', '2026-09-07', '2027-07-02', 'active')`
    );
    await pool.query(
      `INSERT INTO term (year_id, school_id, name, start_date, end_date, status) VALUES
       (?, NULL, 'Term 1', '2026-09-07', '2026-12-11', 'active'),
       (?, NULL, 'Term 2', '2027-01-04', '2027-03-26', 'upcoming'),
       (?, NULL, 'Term 3', '2027-04-12', '2027-07-02', 'upcoming')`,
      [r3.insertId, r3.insertId, r3.insertId]
    );
  }

  const [deps] = await pool.query('SELECT department_id FROM department LIMIT 1');
  if (!deps.length) {
    await pool.query(
      `INSERT INTO department (school_id, name, head, status) VALUES
       (NULL, 'Mathematics', NULL, 'active'),
       (NULL, 'Sciences', NULL, 'active'),
       (NULL, 'Languages', NULL, 'active'),
       (NULL, 'Humanities', NULL, 'active'),
       (NULL, 'ICT & Technology', NULL, 'active'),
       (NULL, 'Arts & Sports', NULL, 'active')`
    );
  }
};

module.exports = { up };
