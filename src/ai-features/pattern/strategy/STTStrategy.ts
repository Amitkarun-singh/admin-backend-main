export interface STTStrategy {
  transcribe(audio: Buffer | string): Promise<string>;
}
