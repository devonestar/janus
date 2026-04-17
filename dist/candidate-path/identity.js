const STOPWORDS = new Set(["a", "an", "the", "to", "into", "then"]);
const MAX_FIT_SUMMARY_LENGTH = 180;
function slugify(text) {
    const ascii = text
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const tokens = ascii
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !STOPWORDS.has(token));
    return tokens.join("-");
}
function normalizeCandidatePath(path) {
    return {
        ...path,
        archetype_slug: slugify(path.archetype_slug || path.name) || "unnamed-candidate",
        fit_summary: path.fit_summary.replace(/\s+/g, " ").trim().slice(0, MAX_FIT_SUMMARY_LENGTH),
    };
}
export function normalizeCandidatePaths(output) {
    const bestPathSlug = output.best_path ? slugify(output.best_path.name) : null;
    const seen = new Set();
    const candidatePaths = (output.candidate_paths ?? [])
        .map(normalizeCandidatePath)
        .filter((candidate) => candidate.fit_summary.length > 0)
        .filter((candidate) => candidate.archetype_slug !== bestPathSlug)
        .filter((candidate) => {
        const dedupeKey = `${candidate.origin}:${candidate.archetype_slug}`;
        if (seen.has(dedupeKey))
            return false;
        seen.add(dedupeKey);
        return true;
    })
        .slice(0, 3);
    return {
        ...output,
        candidate_paths: candidatePaths.length > 0 ? candidatePaths : undefined,
    };
}
export function suppressCandidatePaths(output) {
    const { candidate_paths: _candidatePaths, ...rest } = output;
    return rest;
}
