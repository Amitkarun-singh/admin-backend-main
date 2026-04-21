import OpenAI from "openai";
import { LLMStrategy, Message } from "../../pattern/strategy/LLMStrategy.ts";

import type { Response } from "express";
import { OpenAIStreamAdapter } from "../adapter/OpenAIStreamAdapter.ts";

export class OpenAIProvider implements LLMStrategy {
  declare _client;
  constructor() {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  async streamResponse(messages: Message[], res: Response) {
    console.log("streamResponse");
    const stream = await this._client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      max_tokens: 1200,
    });

    const openAIToSSEAdapter = new OpenAIStreamAdapter(stream);
    openAIToSSEAdapter.pipeTo(res);
  }
}
