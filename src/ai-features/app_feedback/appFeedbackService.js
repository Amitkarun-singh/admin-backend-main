import { insertAppFeedback } from "../modal/appFeedbackModel.js";
export const appFeedbackService = async ({ name, email, subject, message }) => {
  await insertAppFeedback({ name, email, subject, message });
};
