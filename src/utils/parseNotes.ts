interface ParsedNotes {
  short_notes: string | null;
}

export function parseNotes(rawText: unknown): ParsedNotes {
  if (!rawText || typeof rawText !== "string") {
    return { short_notes: null };
  }

  let shortNotes = "";

  const shortMatch = rawText.match(/short\s*notes\s*[:\-]*([\s\S]*)/i);

  if (shortMatch) {
    shortNotes = cleanShortNotes(shortMatch[1]);
  } else {
    shortNotes = cleanShortNotes(rawText);
  }

  return { short_notes: shortNotes || null };
}

function cleanShortNotes(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // remove markdown bold / italic
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1");

  // normalize bullet symbols
  cleaned = cleaned.replace(/•/g, "-");

  // remove LaTeX block wrappers \[ \]
  cleaned = cleaned.replace(/\\\[/g, "\n").replace(/\\\]/g, "\n");

  // fix broken markdown tables
  cleaned = cleaned.replace(/\|\s*\n\s*\|/g, "\n");

  // normalize spacing
  cleaned = cleaned
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n");

  return cleaned.trim();
}