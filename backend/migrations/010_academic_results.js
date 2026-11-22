// 010 — Academic results: scores per student / subject / assessment / term.
const pool = require('../config/database');

const up = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academic_result (
      result_id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      module_id INT NOT NULL,
      class_id INT NOT NULL,
      teacher_id INT NOT NULL,
      assessment VARCHAR(80) NOT NULL,
      score DECIMAL(6,2) NOT NULL,
      max_score DECIMAL(6,2) NOT NULL DEFAULT 100,
      term VARCHAR(40) NOT NULL,
      academic_year VARCHAR(40) NOT NULL,
      school_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_result (student_id, module_id, assessment, term, academic_year),
      INDEX idx_result_class (class_id),
      INDEX idx_result_teacher (teacher_id),
      INDEX idx_result_school (school_id)
    )
  `);
};

module.exports = { up };
