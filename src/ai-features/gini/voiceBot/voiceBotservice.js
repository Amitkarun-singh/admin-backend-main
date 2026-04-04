import OpenAI from "openai";
import { errorMessage } from "../../../../error.js";

import { SarvamAIClient } from "sarvamai";

let client;

try {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch {
  errorMessage.push("API_KEY OPENAI_API_KEY required");
}

const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY,
});

export const voiceBotService = async (message) => {
  console.log("voiceBotService");
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: message,
    max_output_tokens: 100,
  });

  const sarvamResponse = await sarvamClient.textToSpeech.convert({
    text: response.output_text,
    target_language_code: "hi-IN",
    speaker: "arya",
    pace: 1.1,
    speech_sample_rate: 22050,
    enable_preprocessing: true,
    model: "bulbul:v2",
    dict_id: "p_c7b89ab3", // Pronunciation dictionary
  });

  // console.log(sarvamResponse);

  // console.log(response.output_text);
  return {
    role: "assistant",
    content: response.output_text,
    audio: sarvamResponse.audios[0],
  };
};
