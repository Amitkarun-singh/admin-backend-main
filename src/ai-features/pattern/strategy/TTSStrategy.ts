export type base64 = string;
export interface TTSStrategy {
  synthesize(text: string): Promise<base64>;
}
