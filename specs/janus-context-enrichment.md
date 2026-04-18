# Janus Context Enrichment

## Context

Janus currently evaluates a document in isolation. The quality of the evaluation is bounded by the quality of information inside the markdown file. When a spec references a market assumption ("$5B TAM"), names a competitor ("unlike Notion"), or depends on external technology behavior ("Postgres JSONB can handle"), Janus must treat those claims as axioms — it cannot verify or supplement them.

This creates a structural gap: Janus Gate's value proposition is "AI-native decision gate." A gate that cannot check whether the premises it is gating on are grounded produces verdicts that are only as reliable as the author's own beliefs. For specs written in echo chambers or under optimism bias, this means the gate passes systematically flawed proposals.

The pattern is especially acute for:
- Market size claims that can be checked against public data
- Competitor landscape claims that may be outdated
- Technology performance assumptions that can be verified against benchmarks or docs
- Regulatory or compliance assumptions that have documented ground truth
- URLs the author already referenced but Janus never fetched

## Goal

Add a pre-eval enrichment pass (Pass 0) to `janus harness` that automatically extracts verifiable claims and external references from the document and supplements the evaluation context with grounded external information before the 3-pass harness runs.

## Constraints

- Must not require any new API keys beyond what the selected backend already uses.
- Must not block the pipeline if enrichment fails — any exception, including unexpected types (DNS failure, rate-limit 429, malformed JSON), must be caught generically and fall back to unenriched evaluation with a stderr warning.
- Enriched context must be clearly labeled in output so operators know what was injected and what was original. Provenance labels must use a format that cannot collide with author-written text (e.g. machine-prefix sentinel, not free-text bracket notation).
- Must not hallucinate: URL-fetched content is raw external data, LLM research must use conditional language and must only reference claims explicitly present in the document (P5: no free-association).
- Must remain additive: `janus harness` without `--enrich` must produce byte-identical output to current behavior. This invariant must be covered by an automated test.
- Must respect P5 (scope): enrichment must only inject context relevant to claims in the document — no free-association.
- Total added runtime must be bounded: URL fetch timeout 5s per URL, max 5 URLs, LLM research max 1 additional backend call.

## NFRs

- URL extraction: regex must strip trailing punctuation (`)`, `.`, `,`, `>`, `"`, `'`) from matched URLs before fetch to avoid malformed-URL exceptions.
- URL fetch: Content-Type response header must be checked; only `text/html` and `text/plain` are processed. PDF, JSON, binary, and other MIME types are skipped with a stderr notice.
- URL fetch: at most 5 URLs per document, 5s timeout each, 2000 chars extracted per URL after HTML strip.
- Token budget: applied per source, not post-merge. URL batch gets the first N tokens of budget. LLM researcher receives only the remaining budget after URL content is accounted. If URL batch alone exceeds the cap, URL content is tail-truncated first; LLM content is then skipped entirely.
- Enriched document passed to harness must be ≤ 150% of original token count (measured before harness invocation, after per-source truncation).
- If all enrichment sources fail or produce no output, pipeline continues with original document and logs a warning to stderr. Pipeline must not abort.
- Enriched context section must include provenance per item: `[source:url:https://example.com]` or `[source:llm:topic]` using a machine-readable sentinel prefix, not free-text brackets.
- Option C merge: when URL fetch and LLM researcher produce context on the same claim, both are preserved verbatim in adjacent blocks with their own provenance labels. No silent reconciliation. Conflicts are surfaced, not hidden.

## Options

### Option A — URL-only enrichment

Extract all `https?://` URLs from the document. Fetch each URL. Strip HTML. Truncate to 2000 chars. Append as `## Grounding Context (auto-fetched URLs)` section before eval.

Pros: No additional LLM call, fully deterministic, zero hallucination risk.
Cons: Only works if the document contains URLs. Many specs contain zero URLs. No help for implicit claims.

### Option B — LLM researcher pass (Pass 0)

Send the document to the backend with a "researcher" prompt: extract the 3-5 claims that most need external validation, then provide grounding context for each from training knowledge.

Pros: Works on any document regardless of URL presence. Surfaces claims the author didn't externalize.
Cons: LLM knowledge has a training cutoff. Cannot fetch real-time market data. May produce confident-sounding but stale context.

### Option C — Full enrichment (A + B, sequential)

Run A first (URL fetch), then run B (LLM researcher) on the remaining ungrounded claims. Merge both into a single `## Grounding Context` section with per-item provenance labels.

Pros: Maximum coverage. URL-grounded claims are verified; implicit claims are supplemented by LLM knowledge.
Cons: Two additional async operations before harness starts. Complexity of merging two enrichment sources. B can produce stale data even when A succeeds.

### Option D — opencode agent enrichment

Use opencode's native tool-use capability to spawn a research agent that can perform live web searches. The agent receives extracted claims and returns verified, real-time grounded context.

Pros: Real-time information. Can verify market data, check recent news, fetch documentation.
Cons: opencode subprocess stdout reliability issues are unresolved (EC-1 from previous experiment). Non-deterministic output. Requires opencode backend specifically — breaks portability across backends.

## Assumptions

- At least 40% of real-world Janus specs contain at least one URL reference or one externally verifiable market/technology claim.
- LLM-grounded context (Option B) improves eval quality even with a training cutoff, because most spec assumptions are structural rather than real-time.
- The 150% token cap is sufficient to hold meaningful enrichment without exceeding typical LLM context windows.
- Operators will trust labeled enrichment context when provenance is explicit.
- Failing silently (fallback to unenriched) is safer than blocking the pipeline on enrichment errors.

## Unknowns

- Whether URL fetch produces useful signal in practice, or whether most referenced URLs are paywalled, require JS rendering, or return 403.
- Whether LLM researcher output (B) introduces bias that systematically shifts eval verdicts in a particular direction.
- Whether merged A+B context (C) produces conflicts (URL says X, LLM says Y about the same claim) and how to surface that.
- Whether opencode subprocess issue is resolvable in a way that makes Option D reliable.
- Whether enrichment changes the harness verdict in a measurable direction on real-world specs (net upgrade or downgrade rate).
- What the right token cap for enriched context is — 150% is a guess; the right value depends on empirical testing.

## Decision requested

Which enrichment option provides the best risk-adjusted improvement to Janus evaluation quality, given the constraints above? What enabling conditions must hold for that option to be trustworthy, and what failure modes need explicit mitigation?
