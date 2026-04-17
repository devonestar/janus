# Janus Dogfood — Canonical Rejected-Path Identity

## Context

Janus now adds additive rejected-path identity fields:
- `archetype_slug`
- `canonical_key` derived from `violated_principle + archetype_slug`

Current implementation shape:
- `RejectedPath` keeps `name` as display text
- `canonical_key` is computed in application code, not emitted independently by the LLM
- sampling aggregation now groups rejected paths by canonical identity rather than `name.trim()`
- mock backend emits an explicit `archetype_slug`
- single-shot eval and loop paths normalize rejected paths before formatting/validation

Why this matters:
- Janus previously showed stable verdicts and winners but unstable rejected-path naming under sampling
- reviewer automation and future multi-path work need path identity to be machine-stable, not prose-stable
- this is intended as the first harness increment toward a more structurally honest 'many futures' story

## Goal

Evaluate whether the current implementation is a robust first step toward stable multi-path handling, and identify what must hold true for it to count as a successful future rather than a cosmetic patch.

## Constraints

- The change must remain additive and non-breaking to existing consumers.
- The machine identity must not silently collapse distinct rejected paths.
- The implementation must not reintroduce dependence on display text through the back door.
- The step should deliver standalone value even if no later roadmap item ships.

## NFRs

- Sampling should become more stable for semantically identical rejected paths.
- Human-readable output should remain understandable.
- The change should increase reviewer automation safety.

## Options

### Option A — Treat the current implementation as sufficient for now

Ship it as the successful first increment, then defer further work until real usage reveals new issues.

### Option B — Treat the current implementation as a good first increment, but require a follow-up validation phase before calling it stable

Accept the implementation direction, but require explicit validation of slug stability, fallback behavior, and schema-consumer compatibility.

### Option C — Treat the current implementation as premature and revert to name-based aggregation until a fuller design is ready

Assume the new fields and grouping are too risky without stronger evidence.

## Assumptions

- `violated_principle` is stable enough to participate in canonical identity.
- `archetype_slug` can be normalized deterministically in code.
- Current and near-term consumers tolerate additive fields.

## Unknowns

- How stable `archetype_slug` will be across real LLM backends and diverse documents.
- Whether weakly named options will produce misleading collisions.
- Whether existing consumers outside this local repo reject unknown fields or ignore them safely.

## Decision requested

Which path is the most robust success future for this implementation, and what tests or validation gates should Janus require next?
