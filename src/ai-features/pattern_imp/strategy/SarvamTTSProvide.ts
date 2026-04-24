import { base64, TTSStrategy } from "../../pattern/strategy/TTSStrategy.ts";
import { SarvamAIClient } from "sarvamai";
export class SarvamTTSProvide implements TTSStrategy {
  declare _client;
  constructor() {
    this._client = new SarvamAIClient({
      apiSubscriptionKey: process.env.SARVAM_API_KEY,
    });
  }
  async synthesize(text: string): Promise<base64> {
    const responseAudio = await this._client.textToSpeech.convert({
      text: text,
      target_language_code: "hi-IN",
      speaker: "arya",
      pace: 1.1,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: "bulbul:v2",
      dict_id: "p_c7b89ab3", // Pronunciation dictionary
    });
    return responseAudio.audios[0];
  }
}
