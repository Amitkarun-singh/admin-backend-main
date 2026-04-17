import { appFeedbackService } from "./appFeedbackService.js";
export const appFeedbackController = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      throw { status: 400, message: "All fields are required" };
    }
    if (!validateEmail(email)) {
      throw { status: 400, message: "Invalid email" };
    }

    await appFeedbackService({ name, email, subject, message });
    return res.status(201).send();
  } catch (err) {
    const status = err?.status || 500;
    const message = err?.message || "Something went wrong";
    res.status(status).json({ message });
  }
};

function validateEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}
