export type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};
import type { Response } from "express";
export interface LLMStrategy {
  streamResponse(messages: Message[], res: Response): Promise<void>;
  normalResponse(messages: Message[]): Promise<string>;
  // structuredResponse(messages: any[], schema: any): Promise<any>;
}
