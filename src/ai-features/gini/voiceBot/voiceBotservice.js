import OpenAI from "openai";
import { errorMessage } from "../../../../error.js";
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
  });

  console.log(response.output_text);
  return response.output_text;
};
