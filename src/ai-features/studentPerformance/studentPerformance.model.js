import db from "../db/db.js";

/* Summary */
export const getSummary = (studentId) => {
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

  return new Promise((resolve, reject) => {
    db.query(sql, [studentId], (err, result) => {
      if (err) return reject(err);
      resolve(result[0]);
    });
  });
};

/* Subject Mastery */
export const getSubjectMastery = (studentId) => {
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

  return new Promise((resolve, reject) => {
    db.query(sql, [studentId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

/* Monthly Progress */
export const getMonthlyProgress = (studentId) => {
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

  return new Promise((resolve, reject) => {
    db.query(sql, [studentId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

/* Latest Tests */
export const getLatestTests = (studentId) => {
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

  return new Promise((resolve, reject) => {
    db.query(sql, [studentId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
