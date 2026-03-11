import pool from "../db/db.js";

const ChatBotFeedbackSave = (value) => {
  console.log(value);
  return new Promise(async (resolve, reject) => {
    const query = `
        INSERT into Chat_feedback  (userMessage, botResponse, feedback) VALUE (?,?,?)
          
      `;
    const formattedValues = [
      JSON.stringify(value[0]),
      JSON.stringify(value[1]),
      JSON.stringify(value[2]),
    ];

    pool.query(query, formattedValues, (error, results) => {
      if (error) {
        reject(error);
      }
      resolve(results);
    });
  });
};

export { ChatBotFeedbackSave };
