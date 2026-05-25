import type { File } from "../../../type/type.js";
export interface STTStrategy {
  transcribe(audio: File): Promise<string>;
}
