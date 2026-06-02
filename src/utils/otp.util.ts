import crypto from "crypto";

const OTP_SECRET = process.env.OTP_SECRET as string;

interface OtpTokenPayload {
  phone_number: string;
  expiresAt: number;
  signature: string;
}

/* Generate 6-digit OTP */
export const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* Create signed OTP token */
export const createOtpToken = (phone_number: string, otp: string): string => {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

  const data = `${phone_number}.${otp}.${expiresAt}`;

  const signature = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(data)
    .digest("hex");

  return Buffer.from(
    JSON.stringify({ phone_number, expiresAt, signature })
  ).toString("base64");
};

export const verifyOtpToken = (
  phone_number: string,
  otp: string,
  otpToken: string
): true => {
  const decoded: OtpTokenPayload = JSON.parse(
    Buffer.from(otpToken, "base64").toString()
  );

  if (decoded.phone_number !== phone_number) throw new Error("Phone mismatch");

  if (Date.now() > decoded.expiresAt) throw new Error("OTP expired");

  const data = `${phone_number}.${otp}.${decoded.expiresAt}`;

  const expectedSignature = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(data)
    .digest("hex");

  if (expectedSignature !== decoded.signature) throw new Error("Invalid OTP");

  return true;
};