
import { LLMStreamAdapter } from "../../pattern/adapter/LLMStreamAdapter.ts";
export class OpenAIStreamAdapter extends LLMStreamAdapter {
  declare stream;

  constructor(stream) {
    super();
    this.stream = stream;
  }

  async pipeTo(res) {
    try {
      for await (const chunk of this.stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (!content) continue;

        res.write(this.format(content));
      }
      res.write(LLMStreamAdapter.done());
      res.end();
    } catch (e) {
      res.write(LLMStreamAdapter.error());
    }
  }
}
