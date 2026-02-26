export function parseNotes(rawText) {
    if (!rawText || typeof rawText !== "string") {
        return {
            short_notes: null,
            full_notes: null,
        };
    }

    let shortNotes = "";
    let fullNotes = "";

    const shortMatch = rawText.match(
        /short\s*notes\s*[:\-]*([\s\S]*?)(?=full\s*notes)/i
    );

    const fullMatch = rawText.match(
        /full\s*notes\s*[:\-]*([\s\S]*)/i
    );

    if (shortMatch) {
        shortNotes = cleanMarkdown(shortMatch[1].trim());
    }

    if (fullMatch) {
        fullNotes = cleanMarkdown(fullMatch[1].trim());
    }

    return {
        short_notes: shortNotes || null,
        full_notes: fullNotes || null,
    };
}

function cleanMarkdown(text) {
    if (!text) return text;

    return text
        // remove bold/italic
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")

        // remove LaTeX inline math \( \)
        .replace(/\\\((.*?)\\\)/g, "$1")

        // replace weird symbols
        .replace(/\?/g, "-")

        // remove extra spaces
        .replace(/\s+\n/g, "\n")
        .trim();
}
