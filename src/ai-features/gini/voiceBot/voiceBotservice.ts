import { LLMFactory } from "../../pattern_imp/factory/LLMFactory.ts";
import { STTFactory } from "../../pattern_imp/factory/STTFactory.ts";
import { TTSFactory } from "../../pattern_imp/factory/TTSFactory.ts";
import type { Message } from "../../pattern/strategy/LLMStrategy.ts";
import type { Response } from "express";
import type { File } from "../../type/type.d.ts";
export const voiceBotService = async (
  message: Message[],
  audio: File | undefined,
  language : string,
  res: Response,
): Promise<void> => {
  console.info("voiceBotService");

  let transcript: string | null = null;
  let messageWithPrompt: Message[];

  try {
    // 1. Speech to text stage
    if (audio) {
      // STT = await speechToText(audio);
      const STT = STTFactory.create("sarvam");
      transcript = await STT.transcribe(audio);

      res.write(
        `data: ${JSON.stringify({
          type: "stt",
          transcript: transcript,
        })}\n\n`,
      );

      const messageWithTranscript = mergeTranscriptWithMessage(
        message,
        transcript,
      );
      messageWithPrompt = mergeSystemPromptWithMessage(messageWithTranscript,language);
    } else {
      messageWithPrompt = mergeSystemPromptWithMessage(message,language);
    }

    // 2. LLM response
    const LLM = LLMFactory.create("openai");
    const response = await LLM.normalResponse(messageWithPrompt);

    // 3. Text to speech
    const TTS = TTSFactory.create("sarvam");
    const responseAudio = await TTS.synthesize(response); //textToSpeech(response);

    // 4. Final response
    res.write(
      `data: ${JSON.stringify({
        type: "final",
        role: "assistant",
        content: response,
        audio: responseAudio,
        userQuery: transcript !== null ? transcript : null,
      })}\n\n`,
    );

    res.end();
  } catch (error: any) {
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: error.message,
      })}\n\n`,
    );

    res.end();
  }
};

function getSystemPrompt(language : string): string {
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
  Provide responses that sound smooth, friendly, and natural when spoken aloud.
  langauage : ${language}
  if langauge is "hindi" always respond in hindi
  if langauge is "english" always respond in english
  if language is "auto" detected then decide the language on your own and respond in that language
  `;
}

function mergeTranscriptWithMessage(
  message: Message[],
  transcript: string,
): Message[] {
  return message.map((msg) =>
    msg.content === "[Voice message]" ? { ...msg, content: transcript } : msg,
  );
}

function mergeSystemPromptWithMessage(message: Message[],language : string): Message[] {
  return [{ role: "system", content: getSystemPrompt(language) }, ...message];
}
