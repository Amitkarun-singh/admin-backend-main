import Stream from "stream";
import { LLMStreamAdapter } from "../../pattern/adapter/LLMStreamAdapter.ts";
import type { Response } from "express";
import type { OpenAI } from "openai";
type OpenAIChunk = {
  choices?: {
    delta?: {
      content?: string;
    };
  }[];
};
export class OpenAIStreamAdapter extends LLMStreamAdapter {
  declare stream;

  constructor(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  ) {
    super();
    this.stream = stream;
  }

  async pipeTo(res: Response) {
    try {
      for await (const chunk of this.stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (!content) continue;

        res.write(this.format(content));
      }
      res.write(LLMStreamAdapter.done());
      res.end();
    } catch (e) {
      res.write(LLMStreamAdapter.error());
    }
  }
}
