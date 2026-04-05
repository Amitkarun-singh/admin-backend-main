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

  const systemPrompt = `You are a helpful voice assistant. Your responses will be converted to speech using a text-to-speech (TTS) system.

Guidelines:
- Speak naturally, like a human in conversation.
- Keep responses concise and clear (prefer short sentences).
- Avoid long paragraphs, bullet points, or complex formatting.
- Do not use emojis, markdown, or special characters.
- Use simple, everyday language that is easy to understand when heard.
- Add slight conversational tone (e.g., “Sure,” “Okay,” “Got it”).
- Avoid unnecessary details unless the user asks for more.
- When giving numbers, dates, or instructions, format them in a way that sounds natural when spoken.
- If clarification is needed, ask short follow-up questions.
- Avoid repeating the user’s full question.
- Do not mention being an AI unless explicitly asked.

Goal:
Provide responses that sound smooth, friendly, and natural when spoken aloud.`;

  const frontendMessages = message;

  const finalMessages = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: systemPrompt,
        },
      ],
    },
    ...frontendMessages.map((msg) => ({
      role: msg.role,
      content: [
        {
          type: "input_text",
          text: msg.content,
        },
      ],
    })),
  ];

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: finalMessages,
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
