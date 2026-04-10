import OpenAI from "openai";
import { SarvamAIClient } from "sarvamai";
import { Readable } from "stream";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY,
});

export const voiceBotService = async (message, audio) => {
  console.log("voiceBotService");

  let STT = null;
  let messageWithPrompt;
  if (audio) {
    STT = await speechToText(audio);
    const messageWithTranscript = mergeTranscriptWithMessage(message, STT);
    messageWithPrompt = mergeSystemPromptWithMessage(messageWithTranscript);
  } else {
    messageWithPrompt = mergeSystemPromptWithMessage(message);
  }

  const response = await generateResponse(messageWithPrompt);

  const responseAudio = await textToSpeech(response);

  return {
    role: "assistant",
    content: response,
    audio: responseAudio.audios[0],
    userQuery: STT !== null ? STT?.transcript : null,
  };
};

function getSystemPrompt() {
  return `You are a helpful voice assistant. Your responses will be converted to speech using a text-to-speech (TTS) system.
  
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
}

async function speechToText(audio) {
  return await sarvamClient.speechToText.transcribe({
    file: Readable.from(audio.buffer),
    model: "saaras:v3",
    mode: "transcribe", // default mode
  });
}

function mergeTranscriptWithMessage(message, STT) {
  return message.map((msg) =>
    msg.content === "[Voice message]"
      ? { ...msg, content: STT?.transcript }
      : msg,
  );
}

function mergeSystemPromptWithMessage(message) {
  return [{ role: "system", content: getSystemPrompt() }, ...message];
}

async function generateResponse(message) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: message,
  });
  return response.choices[0].message.content;
}

async function textToSpeech(response) {
  return await sarvamClient.textToSpeech.convert({
    text: response,
    target_language_code: "hi-IN",
    speaker: "arya",
    pace: 1.1,
    speech_sample_rate: 22050,
    enable_preprocessing: true,
    model: "bulbul:v2",
    dict_id: "p_c7b89ab3", // Pronunciation dictionary
  });
}
