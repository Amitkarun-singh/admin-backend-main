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
        shortNotes = shortMatch[1].trim();
    }

    if (fullMatch) {
        fullNotes = fullMatch[1].trim();
    }

    return {
        short_notes: shortNotes || null,
        full_notes: fullNotes || null,
    };
}
