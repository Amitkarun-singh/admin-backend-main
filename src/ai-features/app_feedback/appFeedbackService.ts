import { insertAppFeedback } from "../modal/appFeedbackModel.js";
type feedback = {
  name: string;
  email: string;
  subject: string;
  message: string;
};
export const appFeedbackService = async ({
  name,
  email,
  subject,
  message,
}: feedback) => {
  await insertAppFeedback({ name, email, subject, message });
};
