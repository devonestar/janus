# Janus First Increment — Rejected-Path Canonicalization + Explicit Alternative Generation

## Context

Janus branding is strongest when it can honestly say it keeps the robust path among multiple plausible paths. Today the harness already:
- evaluates documents
- identifies a recommended path
- surfaces rejected paths and critical unknowns
- supports repeated sampling with conservative aggregation

But two structural gaps remain:
1. rejected paths are not canonicalized strongly enough under sampling, so the same alternative can appear multiple times with slightly different names
2. alternative handling depends too heavily on whatever options the document already names; Janus does not yet make alternative generation/decomposition explicit enough for the 'many futures' framing to feel structurally true

Observed concrete evidence:
- `src/sampling/aggregator.ts` currently keys rejected paths by `rp.name.trim()`
- a local variance probe showed stable verdicts and winners but unstable rejected-path name sets across repeated sampled runs
- this weakens reviewer automation and makes the futures framing feel more metaphorical than structural

## Goal

Define the first incremental harness change that most directly makes Janus more structurally multi-path without requiring a rewrite.

## Constraints

- The increment must deliver standalone value even if no later roadmap item ships.
- The change must preserve current core outputs: `decision_status`, `best_path`, `critical_unknowns`, and `next_actions`.
- The change must stay compatible with current CLI-first usage and existing backends.
- The increment must not turn Janus into an opaque auto-creative system; alternative generation must stay bounded and inspectable.

## NFRs

- Repeated sampled runs should no longer inflate one rejected alternative into multiple pseudo-distinct paths because of phrasing drift.
- The new alternative logic should improve reviewer/operator understanding rather than merely add extra text.
- The implementation should be small enough to validate with fixtures and smoke tests before broader roadmap expansion.

## Options

### Option A — Canonicalize rejected paths only

Introduce a stable rejected-path key (for example canonical option label + violated principle), but do not change how alternatives are generated.

### Option B — Canonicalize rejected paths and add explicit alternative generation/decomposition

Add stable rejected-path keys and make Janus explicitly surface alternative candidates even when the input document names only one path or underspecifies the choice set.

### Option C — Full scenario engine / multi-path redesign

Attempt a larger redesign where Janus explicitly generates and evaluates many scenarios or path branches as a new subsystem.

## Assumptions

- Existing output schema can absorb a small extension more safely than a total redesign.
- There is operator value in seeing explicit alternatives rather than only a final recommendation + rejections.
- The project should prefer a smallest-useful-step that strengthens both product quality and brand honesty.

## Unknowns

- What exact canonical key is strong enough to unify semantically identical rejected paths without accidentally merging distinct ones.
- Whether explicit alternative generation should live in prompt instructions, post-processing, or a bounded new output field.
- Whether current documents contain enough structure for bounded alternative generation without excessive hallucination risk.

## Decision requested

Which option is the most robust first increment for aligning Janus's harness with its branding, and what conditions should bound that increment?
