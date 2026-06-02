import jwt from "jsonwebtoken";

export const generateAccessToken = (payload: object): string =>
  jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET as string, {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRY ?? "15m") as jwt.SignOptions["expiresIn"],
  });

export const generateRefreshToken = (payload: object): string =>
  jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET as string, {
    expiresIn: (process.env.REFRESH_TOKEN_EXPIRY ?? "7d") as jwt.SignOptions["expiresIn"],
  });