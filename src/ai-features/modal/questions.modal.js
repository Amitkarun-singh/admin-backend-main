import pool from "../db/db.js";

const getPYQ = (value) => {
  return new Promise(async (resolve, reject) => {
    const query = `
        SELECT question, answer, marks
        FROM pyq_questions
        WHERE class = ?
          AND language = ?
          AND subject = ?
          AND chapter = ?
          
      `;

    pool.query(query, value, (error, results) => {
      if (error) {
        reject(error);
      }
      resolve(results);
    });
  });
};

export { getPYQ };
