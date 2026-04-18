export function buildRefinerPrompt(document, fatalConditions, unattackedConditions) {
    const fatalList = fatalConditions.length > 0
        ? fatalConditions.map((c, i) => `  FATAL-${i + 1}: ${c}`).join("\n")
        : "  (none)";
    const uncoveredList = unattackedConditions.length > 0
        ? unattackedConditions.map((c, i) => `  UNCOVERED-${i + 1}: ${c}`).join("\n")
        : "  (none)";
    return `You are a document refiner operating in PATCH MODE.

The following conditions in the document below are either fatally attacked by adversarial scenarios or not yet addressed. Your task is to revise ONLY the sections that directly correspond to these failing conditions.

FATAL conditions (attacked by fatal doom scenarios — must be hardened):
${fatalList}

UNCOVERED conditions (not yet addressed in the document — must be added or strengthened):
${uncoveredList}

PATCH MODE RULES:
1. Return ONLY the revised section text — not the full document.
2. Do not add new options, goals, requirements, or facts not already present in the document.
3. Do not modify sections unrelated to the failing conditions listed above.
4. Use conditional language per P1: "could", "may", "if", "under" — never certainty.
5. Each revised section must begin with its markdown heading (e.g. ## Constraints).
6. If multiple sections need revision, return them sequentially with their headings.
7. Do not include any preamble, explanation, or prose outside the revised sections.

DOCUMENT TO REVISE:
---
${document}
---

Return only the revised section(s) starting with their markdown headings.`;
}
