export function parseQnA(rawText) {
  const blocks = rawText
    .split(/(?:^|\n)\d+\.\s+/) // handles first question too
    .filter((b) => b.trim());

  const results = [];

  blocks.forEach((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) return;

    const question = lines[0];

    let answer = "";
    let isAnswer = false;

    lines.slice(1).forEach((line) => {
      // match Answer:, *Answer:*, **Answer:**
      if (/^\*{0,2}answer\*{0,2}\s*:/i.test(line)) {
        isAnswer = true;
        answer += line.replace(/^\*{0,2}answer\*{0,2}\s*:/i, "").trim();
      } else if (isAnswer) {
        answer += " " + line;
      }
    });

    if (question && answer) {
      results.push({
        question,
        answer: answer.trim(),
      });
    }
  });

  return results;
}
