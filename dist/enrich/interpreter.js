export const ENRICH_OUTPUT_SCHEMA = `{
  "findings": [
    {
      "source": "<URL or package name or stat>",
      "finding": "<one sentence: what the external data shows>",
      "supports_assumption": "<assumption id like A-1, or null>",
      "contradicts_assumption": "<assumption id like A-1, or null>",
      "confidence": "<high|medium|low>"
    }
  ],
  "summary": "<2-3 sentences: overall picture — what external evidence confirms, challenges, or leaves open>"
}`;
export function buildInterpreterPrompt(document, evidence) {
    const successEvidence = evidence.filter(e => e.status === "success" && e.data);
    if (successEvidence.length === 0) {
        return "";
    }
    const evidenceBlock = successEvidence
        .map(e => {
        const label = `[${e.claim.type.toUpperCase()}] ${e.claim.normalized}`;
        const data = JSON.stringify(e.data, null, 2);
        return `${label}\n${data}`;
    })
        .join("\n\n---\n\n");
    return `You are a research analyst verifying the factual grounding of a planning document.

You are given:
1. A planning document with goals, options, and assumptions
2. External evidence fetched from referenced URLs, npm packages, and GitHub repositories

Your task: for each piece of external evidence, determine whether it supports or contradicts specific assumptions in the document. Reference assumption IDs (A-1, A-2, etc.) or critical unknown IDs (U-1, U-2, etc.) when present.

Be concise and factual. Do not invent information. Only report what the evidence actually shows.

PLANNING DOCUMENT:
${document}

---

EXTERNAL EVIDENCE:
${evidenceBlock}

---

Respond with ONLY valid JSON matching this schema (no prose, no markdown fences):
${ENRICH_OUTPUT_SCHEMA}`;
}
