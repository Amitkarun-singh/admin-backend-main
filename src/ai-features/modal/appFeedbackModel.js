import pool from "../db/db.js";

export const insertAppFeedback = async ({ name, email, subject, message }) => {
  const sql =
    "INSERT INTO app_feedback (name, email, subject, message) VALUES (?,?,?,?)";

  await pool.query(sql, [name, email, subject, message]);
};
