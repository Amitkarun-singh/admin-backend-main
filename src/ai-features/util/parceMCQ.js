export function parseMCQs(rawText) {
  const questions = rawText.split(/\n\d+\.\s/).filter((q) => q.trim() !== "");
  const mcqs = [];

  questions.forEach((q) => {
    const lines = q
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const question = lines[0];

    const options = [];
    let correctAnswer = "";

    lines.forEach((line) => {
      if (/^[a-d]\)/i.test(line)) {
        options.push(line.replace(/^[a-d]\)\s*/i, ""));
      }

      if (line.toLowerCase().includes("correct answer")) {
        const match = line.match(/\)\s*(.*)$/);
        if (match) correctAnswer = match[1];
      }
    });

    if (question && options.length === 4) {
      mcqs.push({
        question,
        options,
        // correctAnswer,
      });
    }
  });

  return mcqs;
}
