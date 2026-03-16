import OpenAI from "openai";
import { errorMessage } from "../../../../error.js";
import { maxLength } from "zod";
let client;

try {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch {
  errorMessage.push("API_KEY OPENAI_API_KEY required");
}
export const voiceBotService = async (message) => {
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: message,
    max_output_tokens: 100,
  });

  console.log(response.output_text);
  return { role: "assistant", content: response.output_text };
};
