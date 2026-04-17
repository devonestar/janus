export function analyzeDocumentStructure(document) {
    const hasGoals = /(^|\n)##\s+goal\b|(^|\n)#\s+goal\b|\bgoal\b|\bobjective\b|\bpurpose\b|\baim\b/i.test(document);
    const namedOptionMatches = document.match(/^###\s+Option\s+[A-Za-z0-9]+\b/gm) ?? [];
    const namedOptionsCount = new Set(namedOptionMatches.map((match) => match.trim().toLowerCase())).size;
    return {
        hasGoals,
        namedOptionsCount,
        shouldSurfaceCandidatePaths: hasGoals && namedOptionsCount < 2,
    };
}
