import Stream from "stream";
import { LLMStreamAdapter } from "../../interface/adapter/LLMStreamAdapter.ts";
import type { Response } from "express";
import type { OpenAI } from "openai";
type OpenAIChunk = {
  choices?: {
    delta?: {
      content?: string;
    };
  }[];
};
export class OpenAIStreamAdapter extends LLMStreamAdapter<
  AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
> {
  constructor(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  ) {
    super(stream);
  }

  async pipeTo(res: Response) {
    for await (const chunk of this.stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (!content) continue;

      res.write(this.message(content));
    }
    res.write(this.done());
    res.end();
  }
}
