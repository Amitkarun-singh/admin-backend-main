export type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};
import type { Request } from "express";
export interface LLMStrategy {
  streamResponse(messages: Message[], res: Request): Promise<void>;
  // normalResponse(messages: any[]): Promise<string>;
  // structuredResponse(messages: any[], schema: any): Promise<any>;
}
