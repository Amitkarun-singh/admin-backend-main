// import db from "../db/db.js";

// /* Overall Score */
// export const getOverallScore = (studentId) => {
//   const sql = `
//     SELECT ROUND(AVG(score), 0) AS overallScore
//     FROM test_attempts
//     WHERE student_id = ?
//   `;

//   return new Promise((resolve, reject) => {
//     db.query(sql, [studentId], (err, result) => {
//       if (err) return reject(err);
//       resolve(result[0]);
//     });
//   });
// };

// /* Total Time Spent */
// export const getTimeSpent = (studentId) => {
//   const sql = `
//     SELECT SUM(minutes_spent) AS totalMinutes
//     FROM study_time
//     WHERE student_id = ?
//   `;

//   return new Promise((resolve, reject) => {
//     db.query(sql, [studentId], (err, result) => {
//       if (err) return reject(err);
//       resolve(result[0]);
//     });
//   });
// };

// /* Counts */
// export const getCounts = () => {
//   const questionsSql = `SELECT COUNT(*) AS totalQuestions FROM questions`;
//   const testsSql = `SELECT COUNT(*) AS totalTests FROM tests`;

//   return new Promise((resolve, reject) => {
//     db.query(questionsSql, (err, questions) => {
//       if (err) return reject(err);

//       db.query(testsSql, (err, tests) => {
//         if (err) return reject(err);

//         resolve({
//           totalQuestions: questions[0].totalQuestions,
//           totalTests: tests[0].totalTests,
//         });
//       });
//     });
//   });
// };

// /* Subject-wise Mastery */
// export const getSubjectMastery = (studentId) => {
//   const sql = `
//     SELECT s.name, ROUND(AVG(ta.score), 0) AS score
//     FROM test_attempts ta
//     JOIN tests t ON ta.test_id = t.id
//     JOIN subjects s ON t.subject_id = s.id
//     WHERE ta.student_id = ?
//     GROUP BY s.name
//   `;

//   return new Promise((resolve, reject) => {
//     db.query(sql, [studentId], (err, result) => {
//       if (err) return reject(err);
//       resolve(result);
//     });
//   });
// };

// /* Monthly Progress */
// export const getMonthlyProgress = (studentId) => {
//   const sql = `
//     SELECT mp.month, s.name AS subject_name, mp.score_percentage
//     FROM monthly_progress mp
//     JOIN subjects s ON mp.subject_id = s.id
//     WHERE mp.student_id = ?
//     ORDER BY mp.month
//   `;

//   return new Promise((resolve, reject) => {
//     db.query(sql, [studentId], (err, result) => {
//       if (err) return reject(err);
//       resolve(result);
//     });
//   });
// };

// /* Latest Tests */
// export const getLatestTests = (studentId) => {
//   const sql = `
//     SELECT s.name AS subject, ta.score
//     FROM test_attempts ta
//     JOIN tests t ON ta.test_id = t.id
//     JOIN subjects s ON t.subject_id = s.id
//     WHERE ta.student_id = ?
//     ORDER BY ta.attempted_at DESC
//     LIMIT 3
//   `;

//   return new Promise((resolve, reject) => {
//     db.query(sql, [studentId], (err, result) => {
//       if (err) return reject(err);
//       resolve(result);
//     });
//   });
// };

// /* Time Spent Between Dates */
// export const getTimeSpentBetweenDates = (studentId, start, end) => {
//   const sql = `
//     SELECT SUM(minutes_spent) AS totalMinutes
//     FROM study_time
//     WHERE student_id = ?
//     AND study_date BETWEEN ? AND ?
//   `;

//   return new Promise((resolve, reject) => {
//     db.query(sql, [studentId, start, end], (err, result) => {
//       if (err) return reject(err);
//       resolve(result[0]?.totalMinutes || 0);
//     });
//   });
// };

import db from "../db/db.js";

/* Summary */
export const getSummary = (studentId) => {
  const sql = `
    SELECT 
        COUNT(DISTINCT pt.id) AS totalTests,
        COUNT(pq.id) AS totalQuestions,
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
