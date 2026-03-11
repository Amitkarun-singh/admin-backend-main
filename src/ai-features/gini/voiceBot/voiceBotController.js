import { voiceBotService } from "./voiceBotservice.js";
export const voiceBotController = async (req, res) => {
  const { message } = req.body;

  const response = await voiceBotService(message);
  res.status(200).json({ response });
};
