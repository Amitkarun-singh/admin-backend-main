import { appFeedbackService } from "./appFeedbackService.js";
export const appFeedbackController = async (req, res) => {
  console.log("working, ", req.body);
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    res.status(400).send("all fields are required");
  }
  try {
    await appFeedbackService({ name, email, subject, message });
    return res.status(201).send();
  } catch (err) {
    res.status(err.status || 500).json({ errorMessage: err.message });
  }
};
