import { SarvamAIClient } from "sarvamai";
import { Readable } from "stream";
import { STTStrategy } from "../../pattern/strategy/STTStrategy.ts";

export class SarvamSSTProvider implements STTStrategy {
  declare _client;
  constructor() {
    this._client = new SarvamAIClient({
      apiSubscriptionKey: process.env.SARVAM_API_KEY,
    });
  }
  async transcribe(audio): Promise<string> {
    const STT = await this._client.speechToText.transcribe({
      file: Readable.from(audio.buffer),
      model: "saaras:v3",
      mode: "transcribe", // default mode
    });
    return STT.transcript;
  }
}
