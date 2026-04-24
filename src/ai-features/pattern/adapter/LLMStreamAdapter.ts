import { StreamAdapter } from "./StreamAdapter.ts";
import type { Response } from "express";
export abstract class LLMStreamAdapter<T> extends StreamAdapter {
  protected stream: T;

  protected constructor(stream: T) {
    super();
    this.stream = stream;
  }
  abstract pipeTo(res: Response): Promise<void>;
}
