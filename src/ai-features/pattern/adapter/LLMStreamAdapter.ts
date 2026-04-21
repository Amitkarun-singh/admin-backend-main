import type { Response } from "express";
export abstract class LLMStreamAdapter {
  abstract pipeTo(res: Response): Promise<void>;
  format(content) {
    return `data: ${JSON.stringify({
      choices: [{ delta: { content } }],
    })}\n\n`;
  }

  static done() {
    return "data: [DONE]\n\n";
  }

  static error() {
    return `data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`;
  }
}
