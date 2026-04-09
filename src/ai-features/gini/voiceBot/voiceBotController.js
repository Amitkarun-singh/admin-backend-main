import { voiceBotService } from "./voiceBotservice.js";
export const voiceBotController = async (req, res) => {
  const { message } = req.body;
  const file = req.file;

  const msgArr = JSON.parse(message);

  const response = await voiceBotService(msgArr, file);
  res.status(200).json({ response });
};
