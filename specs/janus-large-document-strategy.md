# Janus Large Document Strategy

## Context

Janus currently passes the entire input document into the LLM prompt without any size awareness. For documents under 10 KB this works well — eval completes in under 2 minutes on the default claude backend. But real-world specs routinely exceed 15 KB, and some reach 30+ KB.

Empirical data from this dogfood round:
- `fixtures/smoke.md` (~1 KB): ~40s per eval
- Typical Janus spec (~5 KB): ~1-2 min per eval
- `doctor-corpus-entropy.md` (31 KB): **2:51** per eval on claude backend

The 31 KB document completed successfully within the 240s default timeout, but it consumed nearly the full budget. Adding `--samples 3` would push wall-clock to ~9 minutes. Running `harness` (3 passes) would take ~9 minutes. Running `loop --harness` with 3 iterations would take ~27 minutes.

Current backend timeouts:
- claude: 240s
- opencode: 240s
- codex: 180s
- openai-api: 120s
- anthropic-api: 120s

The problem is not just timeout risk. Larger documents also degrade LLM attention quality — the model must hold more context while reasoning about constraints, options, and failure modes. There is no empirical data on whether Janus output quality degrades meaningfully above a specific document size threshold.

Additionally, the compact prompt (`system-compact.ts`, 29 lines) is already used for CLI backends, but the document itself is never compressed, summarized, or restructured regardless of size.

## Goal

Define a strategy for how Janus handles documents that exceed a size threshold, so that:

1. Eval quality does not silently degrade on large documents without operator awareness.
2. Timeout risk is managed explicitly rather than by hoping the default is enough.
3. Operators have visibility into whether document size affected the evaluation.
4. The strategy extends naturally to harness and loop modes, not just single-shot eval.

## Constraints

- C-1: No new npm dependencies. Any solution must use Node built-ins or existing dependencies (commander, yaml).
- C-2: Default behavior for documents under 15 KB must not change. Zero regression on existing workflows.
- C-3: The strategy must work across all backends. Backend-specific solutions are not acceptable as the primary path.
- C-4: Document content must not be silently dropped or truncated without operator awareness. If content is removed, the operator must know what was removed and why.
- C-5: The strategy must respect P5 (scope discipline). Any document restructuring must preserve all stated goals, constraints, options, assumptions, and dependencies — not selectively discard inconvenient sections.
- C-6: Single-maintainer scope. The chosen approach must be implementable in one cycle without architectural rewrites.
- C-7: The solution must not require operator action for documents under the threshold. Size handling should be automatic with opt-out, not opt-in.

## NFRs

- Document size must be measured in bytes before prompt construction, not after LLM tokenization (tokenization is model-dependent and violates C-3).
- A size warning must be emitted to stderr when document exceeds the threshold, regardless of whether any mitigation is applied.
- Timeout must be dynamically adjusted based on document size when no explicit `--timeout` flag is provided.
- Eval output should include a `document_size_kb` field (or equivalent metadata) so operators can correlate size with quality.
- Harness and loop modes must inherit the same size-aware behavior as eval.
- The mock backend must remain unaffected by size handling — it processes documents deterministically regardless of size.

## Options

### Option A — Size-aware timeout + warning + metadata only

Measure document size before eval. If above threshold (default 15 KB):
1. Emit a stderr warning: `[janus] Document is {N} KB — evaluation may take longer and quality may degrade for documents above 15 KB.`
2. Auto-scale timeout: `timeout = max(240s, ceil(size_kb / 10) * 60s)` — roughly 60s per 10 KB.
3. Add `document_size_kb` to output metadata.

No document modification. The operator decides whether to restructure.

- Satisfies C-1 through C-7
- Lowest implementation complexity
- Risk: does not actually improve quality on large documents — only warns
- Risk: timeout scaling is heuristic and may not match actual backend performance

### Option B — Section-priority extraction before eval

Measure document size. If above threshold:
1. Parse the document for key sections: Goal, Constraints, NFRs, Options, Assumptions, Dependencies, Unknowns.
2. Extract these sections and discard non-essential content (narrative preamble, appendices, detailed implementation notes).
3. Pass the extracted core to the LLM, with a header noting what was removed.
4. Emit a stderr warning listing removed sections.

Falls back to Option A behavior if extraction fails or the document lacks parseable structure.

- Directly addresses quality degradation by reducing noise
- Satisfies C-4 (operator knows what was removed) and C-5 (key sections preserved)
- Risk: "non-essential" is a judgment call — some narrative context may be load-bearing
- Risk: section detection is regex-based and may fail on non-standard document structures
- Risk: higher implementation complexity than Option A

### Option C — Two-pass eval for large documents

Measure document size. If above threshold:
1. Pass 1: Send a condensed extraction prompt asking the LLM to extract goals, constraints, options, assumptions, dependencies, and unknowns as structured fields.
2. Pass 2: Send the extracted fields (not the original document) through the standard eval prompt.

The original document is attached as reference but the LLM evaluates the extracted structure.

- Most robust quality protection — the eval prompt operates on clean structured input
- Risk: doubles LLM cost and wall-clock time for large documents
- Risk: Pass 1 extraction quality is itself model-dependent
- Risk: violates C-6 if the extraction prompt requires significant tuning per backend

### Option D — Configurable size threshold with --max-size flag

Add a `--max-size <kb>` CLI flag (default: no limit). If the document exceeds the limit:
1. Emit a clear error and exit with EXIT_ERROR.
2. Operator must restructure the document manually.

Combined with Option A's warning for documents approaching the limit.

- Simplest enforcement — operator owns the problem
- Satisfies C-2 through C-7 trivially
- Risk: unhelpful — Janus refuses to evaluate rather than adapting
- Risk: operators may just raise the limit instead of restructuring

## Assumptions

- A-1: LLM attention quality degrades meaningfully above ~15 KB of input document text, independent of model family.
- A-2: The key sections (Goal, Constraints, NFRs, Options, Assumptions, Dependencies, Unknowns) contain the load-bearing content for evaluation; narrative surrounding them is supplementary.
- A-3: Dynamic timeout scaling proportional to document size is a reasonable heuristic across backends.
- A-4: Operators prefer a warning + automatic adaptation over a hard rejection of large documents.
- A-5: The 31 KB `doctor-corpus-entropy.md` evaluation (2:51, recommend, medium robustness) represents a reasonable upper bound for current single-eval performance.

## Unknowns

- U-1: At what document size does Janus output quality actually degrade? The 15 KB threshold is a guess based on general LLM context-window research, not Janus-specific empirical data.
- U-2: Whether section-priority extraction (Option B) preserves enough context for accurate evaluation, or whether it systematically loses load-bearing narrative that affects the verdict.
- U-3: Whether dynamic timeout scaling is sufficient across all backends, or whether some backends (openai-api at 120s default) need per-backend scaling curves.
- U-4: Whether operators want size metadata in the output, or whether it adds noise to an already dense result.
- U-5: Whether two-pass extraction (Option C) produces meaningfully better evaluations than single-pass on the full document, or whether the extraction step introduces its own quality loss.

## Decision requested

Which strategy gives Janus the best size-aware behavior for large documents while preserving evaluation quality? Specifically:

1. Should Janus start with Option A (warn + timeout + metadata) as the minimum viable approach, then layer Option B or C based on empirical quality data?
2. Or should Janus go directly to Option B or C as the primary strategy?
3. What threshold should trigger size-aware behavior, and how should it be validated?
