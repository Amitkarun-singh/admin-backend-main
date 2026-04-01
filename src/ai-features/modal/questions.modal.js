import pool from "../db/db.js";
const insertTest = (values) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO practice_tests (class, subject, chapter, language, student_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    pool.query(query, values, (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results.insertId);
    });
  });
};

const insertQuestions = (testId, questionsData) => {
  // console.log("questionsData", questionsData);
  return new Promise((resolve, reject) => {
    const values = [];

    // Loop through each question type
    for (const type in questionsData) {
      questionsData[type].forEach((q) => {
        const options = q.options ? JSON.stringify(q.options) : null;
        const answer = q.answer || null; // ensure answer exists
        console.log(q.id);

        values.push([
          testId,
          type,
          q.question,
          options,
          answer,
          null,
          q.id,
          q.answer_explanation,
          q.marks,
        ]);
      });
    }

    if (!values.length) return resolve(0);

    const query = `
      INSERT INTO practice_questions
        (test_id, type, question, options, answer, student_answer, question_id, answer_explanation, marks)
      VALUES ?
    `;

    pool.query(query, [values], (error, results) => {
      if (error) return reject(error);
      resolve(results.affectedRows);
    });
  });
};
export { insertTest, insertQuestions };

export const insertAnswer = (values) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE practice_questions 
      SET student_answer = ?
      WHERE question_id = ? AND test_id = ?
    `;

    pool.query(query, [values[2], values[0], values[1]], (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results.affectedRows);
    });
  });
};

export const fetchTestResultById = (testId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        *
      FROM practice_questions
      WHERE test_id = ?
    `;

    pool.query(query, [testId], (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results);
    });
  });
};
