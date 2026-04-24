import type { Response } from "express";
export type SSEEventType = "message" | "error" | "done" | "stt";

export type SSEEvent<T = any> = {
  event: SSEEventType;
  data: T;
};

type error = {
  type: string;
  message: string;
  extra?: Record<string, any>;
};
export class StreamAdapter {
  protected format<T>(event: SSEEvent<T>) {
    return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
  }

  protected message(content: string) {
    return this.format({
      event: "message",
      data: { content },
    });
  }

  formatError(err: error) {
    return this.format({
      event: "error",
      data: {
        type: err.type,
        message: err.message,
        ...(err.extra ?? {}),
      },
    });
  }

  protected done() {
    return this.format({
      event: "done",
      data: {},
    });
  }
}
