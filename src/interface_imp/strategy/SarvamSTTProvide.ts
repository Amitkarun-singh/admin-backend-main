import { SarvamAIClient } from "sarvamai";
import { Readable } from "stream";
import { STTStrategy } from "../../interface/strategy/STTStrategy.ts";
import type { File } from "../../type/type.js";

export class SarvamSSTProvider implements STTStrategy {
  declare _client;
  constructor() {
    this._client = new SarvamAIClient({
      apiSubscriptionKey: process.env.SARVAM_API_KEY,
    });
  }
  async transcribe(audio: File): Promise<string> {
    const STT = await this._client.speechToText.transcribe({
      file: Readable.from(audio.buffer),
      model: "saaras:v3",
      mode: "transcribe", // default mode
    });
    return STT.transcript;
  }
}
