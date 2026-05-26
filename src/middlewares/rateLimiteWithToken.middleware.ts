import type { Response, Request, NextFunction } from "express";
import redisClient from "../configs/redis/redis.ts";

import express from "express";
import { encoding_for_model } from "tiktoken";
import { TokenLimitExceededError } from "../error/AppError.ts";

const app = express();

app.use(express.json());

const encoder = encoding_for_model("gpt-4o-mini");

function countTokens(text = "") {
  return encoder.encode(text).length;
}

export default async function tokenCounter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = String(req.user.user_id);

  // Get existing balance
  let tokens = await redisClient.get(userId);

  // First time user
  if (!tokens) {
    await redisClient.set(userId, 500);
    tokens = "500";
  }

  const remainingTokens = Number(tokens);

  const requestBody = JSON.stringify(req.body || {});
  const requestTokens = countTokens(requestBody);

  console.log("Request Tokens:", requestTokens);

  // BLOCK REQUEST BEFORE PROCESSING
  if (remainingTokens <= 0 || remainingTokens < requestTokens) {
     throw new TokenLimitExceededError()
  }

  let responseTokens = 0;

  const originalWrite = res.write;
  const originalSend = res.send;

  // Count streamed responses
  res.write = function (chunk: any, ...args: any[]) {
    const responseBody =
      typeof chunk === "string"
        ? chunk
        : Buffer.isBuffer(chunk)
        ? chunk.toString()
        : JSON.stringify(chunk);

    responseTokens += countTokens(responseBody);

    return originalWrite.apply(res, [chunk, ...args]);
  };

  // Count normal responses
  res.send = function (body: any) {
    const responseBody =
      typeof body === "string" ? body : JSON.stringify(body);

    responseTokens += countTokens(responseBody);

    return originalSend.call(this, body);
  };

  // After response finished
  res.on("finish", async () => {
    const totalTokens = requestTokens + responseTokens;

    console.log("Request Tokens:", requestTokens);
    console.log("Response Tokens:", responseTokens);
    console.log("Total Tokens:", totalTokens);

    const updatedBalance = remainingTokens - totalTokens;

    await redisClient.set(userId, updatedBalance);

    console.log("Remaining Tokens:", updatedBalance);
  });

  next();
}