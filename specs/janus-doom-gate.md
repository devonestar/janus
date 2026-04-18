# Janus Doom Gate — Adversarial Pre-Mortem Command

## Context

Janus Gate answers "should we proceed?" — a binary pass/fail verdict on a spec or PRD. This is valuable at merge time, but developers and product people face a different question earlier in the lifecycle: **"how does this idea die?"**

Today, failure analysis in Janus is a side-effect of evaluation. Rejected paths get a one-line `rejection_reason` and a principle code. The `failure_chain` extension (spec: `janus-failure-future-narratives.md`) proposes adding causal chains to rejected paths, but only for paths that were already rejected by the evaluator. There is no mode that intentionally stress-tests **all** paths — including the recommended one.

Additionally, Janus Gate requires a structured markdown document with headings (Context, Goal, Constraints, Options, Unknowns). Many early-stage ideas exist only as a single sentence or a short paragraph. There is no entry point for unstructured input.

The gap: Janus has no adversarial mode that takes any plan — structured or not — and systematically enumerates how it fails.

## Goal

Add a `janus doom <input>` command that accepts a plan (markdown file or inline text) and returns a structured set of failure scenarios, each with a causal chain, severity, survivability assessment, and mapped principle. The output answers "how does this die?" rather than "should this proceed?"

## Constraints

- C-1: Must reuse existing backend infrastructure (`JanusBackend` interface). No new LLM integration layer.
- C-2: Must work with all existing backends (claude, codex, mock, etc.).
- C-3: Inline text input (not just `.md` files) must be supported from Phase 1.
- C-4: Output schema must be additive — must not break existing `eval`/`gate` consumers.
- C-5: Runtime for a single doom evaluation should be comparable to a single `eval` call (< 240s on claude backend).
- C-6: Must not duplicate what `failure_chain` on rejected paths already provides — doom is complementary, not redundant.
- C-7: The doom report must be grounded in the input's own content and stated constraints, not generic failure patterns.

## NFRs

- Each doom scenario should have 2-5 causal steps (same granularity as `failure_chain` spec).
- Severity levels: `fatal`, `severe`, `moderate`, `low`.
- Survivability: `unsurvivable`, `conditional` (with stated survival condition), `survivable`.
- A top-level `survival_rating` summarizes overall resilience: `fragile`, `resilient`, `antifragile`.
- Output formats: json, markdown, yaml (consistent with existing `--format` flag).
- `--samples N` support for variance reduction (reuse existing aggregator where applicable).

## Options

### Option A — New `doom` command with dedicated prompt and output schema

Add `janus doom` as a new top-level command alongside `eval`, `compare`, `loop`, `gate`. It gets its own system prompt optimized for adversarial failure enumeration, and a new output schema (`DoomReport`) separate from the eval schema.

- Inline text: `janus doom "migrate to microservices"`
- File: `janus doom spec.md`
- Shares backend selection, format flags, and samples infrastructure with eval.
- New prompt instructs the LLM to act as an adversarial red-team, systematically attacking every aspect of the plan.
- Output schema: `doom_scenarios[]`, `survival_rating`, `doom_count`, `verdict`.

### Option B — Extend `eval` with `--doom` flag

Add a `--doom` flag to the existing `janus eval` command. When set, the evaluator switches to adversarial mode: instead of producing a `decision_status`, it produces a doom report. The eval prompt is augmented with adversarial instructions.

- Reuses the existing eval pipeline.
- No new command surface.
- But: overloads `eval` semantics. "eval with doom" is conceptually different from "eval."
- Inline text support would still require changes to the eval input handler.

### Option C — Doom as a post-processor on eval output

Run a normal `janus eval` first, then pass the eval output through a second LLM call that generates adversarial doom scenarios based on the eval's `best_path`, `rejected_paths`, and `critical_unknowns`.

- Leverages existing eval quality.
- But: doubles runtime cost (2x LLM calls).
- Cannot work on inline text without first running eval (which requires structured input).
- Couples doom quality to eval quality — if eval misses something, doom inherits the blind spot.

### Option D — Doom as a prompt-only variant (no new schema)

Use the existing eval pipeline but swap the system prompt for an adversarial one. Output still uses the eval schema, but `rejected_paths` is reinterpreted as doom scenarios and `best_path` becomes "most survivable path."

- Minimal code change.
- But: semantic overloading makes output confusing. A `rejected_path` in doom context means something different than in eval context.
- No room for doom-specific fields (severity, survivability, survival_rating).

## Assumptions

- A-1: Developers want adversarial analysis early in the decision lifecycle, before a full spec exists.
- A-2: LLM backends can produce domain-relevant (not generic) failure scenarios from short unstructured input.
- A-3: The adversarial framing ("how does this die?") produces different and complementary insights vs. the evaluative framing ("should this proceed?").
- A-4: A dedicated output schema is worth the added surface area, because doom scenarios have different fields than eval verdicts.
- A-5: Users will run `doom` and `gate`/`eval` at different lifecycle stages, not always together.

## Unknowns

- U-1: Can LLMs generate grounded (not generic) failure scenarios from a single sentence of input? The less context provided, the higher the risk of hallucinated doom scenarios that sound plausible but are not relevant.
- U-2: What is the right number of doom scenarios to generate? Too few misses real risks; too many creates noise. Is 3-7 the right range, or should it be adaptive?
- U-3: How should `--samples N` aggregation work for doom scenarios? Eval aggregates on `decision_status` (a closed set). Doom scenarios are open-ended — deduplication across samples is harder.
- U-4: Will users trust adversarial output that attacks their own idea? There is a UX risk that doom reports feel hostile rather than helpful.
- U-5: How does doom interact with `failure_chain` on rejected paths? If both ship, is there redundancy or are they clearly complementary (doom = all paths attacked, failure_chain = only rejected paths narrated)?

## Decision requested

Which option best supports an adversarial pre-mortem command that developers use first on unstructured ideas, with a path toward general idea validation — and what conditions should bound the first implementation?
