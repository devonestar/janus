const STOPWORDS = new Set(["a", "an", "the", "to", "into", "then"]);
const WEAK_SLUGS = new Set([
    "option",
    "alternative",
    "approach",
    "path",
    "plan",
    "strategy",
    "baseline",
]);
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
function deriveArchetypeSlug(path) {
    // 1. Explicit archetype_slug from LLM — trust only if non-weak
    const explicit = typeof path.archetype_slug === "string" ? slugify(path.archetype_slug) : "";
    const weakExplicit = WEAK_SLUGS.has(explicit) || /^option-[a-z0-9]+$/.test(explicit);
    if (explicit && !weakExplicit)
        return explicit;
    // 2. Labeled option ("Option B — anything") — use label only; descriptors drift across samples
    const labeledOptionMatch = path.name.match(/^option\s+([a-z0-9]+)\s*[—:-]/i);
    if (labeledOptionMatch) {
        return `option-${labeledOptionMatch[1].toLowerCase()}`;
    }
    // 3. Bare option reference ("Option B")
    const optionMatch = path.name.match(/^option\s+([a-z0-9]+)/i);
    if (optionMatch)
        return `option-${optionMatch[1].toLowerCase()}`;
    // 4. Non-option name — truncate to first 4 content words for stability
    const nameSlug = slugify(path.name);
    if (nameSlug && !WEAK_SLUGS.has(nameSlug)) {
        return nameSlug.split("-").slice(0, 4).join("-");
    }
    // 5. Last resort — first 4 content words of rejection_reason
    const reasonSlug = slugify(path.rejection_reason).split("-").slice(0, 4).join("-");
    return reasonSlug || "unnamed-path";
}
export function deriveCanonicalKey(path) {
    const principle = path.violated_principle?.trim() || "none";
    const archetypeSlug = deriveArchetypeSlug(path);
    return `${principle}:${archetypeSlug}`;
}
export function normalizeRejectedPath(path) {
    const archetypeSlug = deriveArchetypeSlug(path);
    return {
        ...path,
        archetype_slug: archetypeSlug,
        canonical_key: `${path.violated_principle?.trim() || "none"}:${archetypeSlug}`,
    };
}
export function normalizeOutputRejectedPaths(output) {
    return {
        ...output,
        rejected_paths: output.rejected_paths.map(normalizeRejectedPath),
    };
}
