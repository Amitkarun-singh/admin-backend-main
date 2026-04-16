import pool from "../db/db.js";

export const insertTest = async (values) => {
  const query = `
    INSERT INTO practice_tests (class, subject, chapter, language, student_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  const [result] = await pool.query(query, values);
  return result.insertId;
};

export const insertQuestions = async (testId, questionsData) => {
  const values = [];

  for (const type in questionsData) {
    questionsData[type].forEach((q) => {
      values.push([
        testId,
        type,
        q.question,
        q.options ? JSON.stringify(q.options) : null,
        q.answer || null,
        null,
        q.id,
        q.answer_explanation,
        q.marks,
      ]);
    });
  }

  if (!values.length) return 0;

  const query = `
    INSERT INTO practice_questions
      (test_id, type, question, options, answer, student_answer, question_id, answer_explanation, marks)
    VALUES ?
  `;

  const [result] = await pool.query(query, [values]);
  return result.affectedRows;
};

export const insertAnswer = async (values) => {
  const query = `
    UPDATE practice_questions
    SET 
      student_answer = ?,
      is_correct = CASE 
        WHEN TRIM(LOWER(answer)) = TRIM(LOWER(?)) THEN 1
        ELSE 0
      END
    WHERE question_id = ? AND test_id = ?
  `;

  const [result] = await pool.query(query, [
    values[2], // student_answer
    values[2], // compare answer
    values[0], // question_id
    values[1], // test_id
  ]);

  return result.affectedRows;
};

export const fetchTestResultById = async (testId) => {
  const query = `
    SELECT *
    FROM practice_questions
    WHERE test_id = ?
  `;

  const [rows] = await pool.query(query, [testId]);
  return rows;
};
