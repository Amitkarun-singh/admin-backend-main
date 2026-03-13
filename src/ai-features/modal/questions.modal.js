import pool from "../db/db.js";
const insertTest = (values) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO practice_tests (class, subject, chapter, language)
      VALUES (?, ?, ?, ?)
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

        values.push([testId, type, q.question, options, answer, null, q.id]);
      });
    }

    if (!values.length) return resolve(0);

    const query = `
      INSERT INTO practice_questions
        (test_id, type, question, options, answer, student_answer, question_id)
      VALUES ?
    `;

    pool.query(query, [values], (error, results) => {
      if (error) return reject(error);
      resolve(results.affectedRows);
    });
  });
};
export { insertTest, insertQuestions };
