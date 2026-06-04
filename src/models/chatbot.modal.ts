import pool from "../configs/database/db.ts";

export const ChatBotFeedbackSave = async (value : Array<any>) => {
  console.log(value);

  const query = `
    INSERT INTO Chat_feedback (userMessage, botResponse, feedback)
    VALUES (?, ?, ?)
  `;

  const formattedValues = [
    JSON.stringify(value[0]),
    JSON.stringify(value[1]),
    JSON.stringify(value[2]),
  ];

  const [result] = await pool.query(query, formattedValues);

  return result;
};
