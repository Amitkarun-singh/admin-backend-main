import type { File } from "../../type/type.d.ts";
export interface STTStrategy {
  transcribe(audio: File): Promise<string>;
}
