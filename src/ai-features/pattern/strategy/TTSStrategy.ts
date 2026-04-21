type base64 = string;
export interface TTSResult {
  audio: base64;
  raw?: unknown;
}

export interface TTSStrategy {
  synthesize(text: string): Promise<TTSResult>;
}
