import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export interface MailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.MY_MAIL,
    pass: process.env.MY_PASSWORD,
  },
});

/**
 * Sends an email using the configured Gmail transporter.
 * Both `html` and `text` are optional; at least one should be provided.
 */
export async function sendMail(options: MailOptions): Promise<void> {
  const { to, subject, html, text, from } = options;

  const mailOptions = {
    from: from ?? `"Schools2AI" <${process.env.MY_MAIL}>`,
    to,
    subject,
    ...(html && { html }),
    ...(text && { text }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Email sent to ${to}: ${info.response}`);
  } catch (error) {
    console.error("[Mailer] Failed to send email:", error);
    throw new Error("Failed to send email");
  }
}

/**
 * Sends a welcome email containing the auto-generated plain-text password.
 */
export async function sendWelcomeEmail(
  to: string,
  fullName: string,
  username: string,
  plainPassword: string
): Promise<void> {
  const subject = "Welcome to Schools2AI – Your Account Details";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #4f46e5;">Welcome to Schools2AI! 🎓</h2>
      <p>Hello <strong>${fullName || "there"}</strong>,</p>
      <p>Your account has been successfully created. Below are your login credentials:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; background: #f3f4f6; font-weight: bold; width: 40%;">Email</td>
          <td style="padding: 8px; background: #f9fafb;">${to}</td>
        </tr>
        <tr>
          <td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Username</td>
          <td style="padding: 8px; background: #f9fafb; font-family: monospace; letter-spacing: 1px;">${username}</td>
        </tr>
        <tr>
          <td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Temporary Password</td>
          <td style="padding: 8px; background: #f9fafb; font-family: monospace; letter-spacing: 2px;">${plainPassword}</td>
        </tr>
      </table>
      <p style="color: #ef4444;"><strong>Important:</strong> Please change your password immediately after your first login.</p>
      <p style="color: #6b7280; font-size: 13px;">If you did not expect this email, please contact your school administrator.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Schools2AI. All rights reserved.</p>
    </div>
  `;

  await sendMail({ to, subject, html });
}
