import pool from "../configs/database/db.ts";

export const insertAppFeedback = async ({ name, email, subject, message }: { name: string; email: string; subject: string; message: string }) => {
  const sql =
    "INSERT INTO app_feedback (name, email, subject, message) VALUES (?,?,?,?)";

  await pool.query(sql, [name, email, subject, message]);
};
