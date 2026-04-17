import pool from "../db/db.js";

/* Summary */
export const getSummary = async (studentId) => {
  const sql = `
    SELECT 
        COUNT(DISTINCT pt.id) AS totalTests,
        COUNT(pq.id) AS totalQuestions,
        SUM(pq.is_correct) AS totalCorrectAnswers,
        ROUND(AVG(pq.is_correct) * 100) AS overallScore
    FROM practice_tests pt
    JOIN practice_questions pq 
        ON pt.id = pq.test_id
    WHERE pt.student_id = ?
  `;

  try {
    const [rows] = await pool.execute(sql, [studentId]);
    return rows[0];
  } catch (err) {
    throw err;
  }
};

/* Subject Mastery */
export const getSubjectMastery = async (studentId) => {
  const sql = `
    SELECT 
        pt.subject AS label,
        ROUND(AVG(pq.is_correct) * 100) AS value
    FROM practice_tests pt
    JOIN practice_questions pq 
        ON pt.id = pq.test_id
    WHERE pt.student_id = ?
    GROUP BY pt.subject
  `;

  try {
    const [rows] = await pool.execute(sql, [studentId]);
    return rows;
  } catch (err) {
    throw err;
  }
};

/* Monthly Progress */
export const getMonthlyProgress = async (studentId) => {
  const sql = `
    SELECT 
        MONTH(pt.created_at) AS month,
        pt.subject AS subject_name,
        ROUND(AVG(pq.is_correct) * 100,2) AS score_percentage
    FROM practice_tests pt
    JOIN practice_questions pq 
        ON pt.id = pq.test_id
    WHERE pt.student_id = ?
    GROUP BY MONTH(pt.created_at), pt.subject
    ORDER BY month
  `;

  try {
    const [rows] = await pool.execute(sql, [studentId]);
    return rows;
  } catch (err) {
    throw err;
  }
};

/* Latest Tests */
export const getLatestTests = async (studentId) => {
  const sql = `
    SELECT 
        pt.subject,
        ROUND(AVG(pq.is_correct) * 100) AS score
    FROM practice_tests pt
    JOIN practice_questions pq 
        ON pt.id = pq.test_id
    WHERE pt.student_id = ?
    GROUP BY pt.id
    ORDER BY pt.created_at DESC
    LIMIT 3
  `;

  try {
    const [rows] = await pool.execute(sql, [studentId]);
    return rows;
  } catch (err) {
    throw err;
  }
};
