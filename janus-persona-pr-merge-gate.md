# Janus Persona-Gated PR and Merge Workflow

## Context

Janus already evaluates markdown plans and specs, and this repo is moving from ad-hoc local editing toward a PR-driven maintenance workflow. The operator wants Janus itself to participate in approval guardrails using sub-agent/persona roles, so that PR creation and merge both pass through Janus-native checks rather than generic CI alone.

Current repo realities that shape this design:
- Janus evaluates markdown, not raw code diffs.
- `decision_status` and `best_path` are stable enough to trust operationally, but `rejected_paths[].name` is not stable enough to use as an exact automation key.
- The repo still lacks a broad regression suite, so automation must stay reversible and keep the human operator as final merge authority.
- Self-modifying PRs (prompt/schema/aggregation changes) are riskier because they can alter Janus's own gate behavior.

## Goal

Define a Janus-native workflow where PR creation and merge are each gated by Janus personas with clear responsibilities, while preserving human final authority and avoiding self-certification traps.

## Constraints

- Janus gates must run on markdown representations of change intent, not on undocumented agent assumptions.
- The worker that authors a PR must not be the only Janus voice that approves it.
- The final merge decision must remain reversible: operator merge authority is required.
- Self-modifying PRs must not be auto-approved by the same Janus logic they change.

## NFRs

- The workflow must be understandable enough that a maintainer can explain why a PR was allowed, blocked, or escalated.
- The workflow must fail closed for ambiguous or high-risk changes.
- The workflow should be implementable incrementally on top of the current repo, without requiring a full test framework first.

## Personas

### Persona A — Author Gate

Runs before a PR is opened.

Responsibilities:
- translate issue/task + diff intent into markdown suitable for Janus
- evaluate whether the proposed change should even become a PR
- surface `critical_unknowns` and `rejected_paths` before review starts

Allowed outputs:
- `recommend` → PR may be opened normally
- `conditional` → PR may be opened, but must include Janus risk summary in the body
- `blocked` → PR must not be opened automatically

### Persona B — Reviewer Gate

Runs after the PR exists, using a read-only context independent from the authoring worker.

Responsibilities:
- reconstruct PR intent independently from the PR diff/body
- run Janus evaluation without trusting the author-side summary blindly
- compare author-side and reviewer-side verdicts
- escalate mismatches or unresolved unknowns to the human operator

Allowed outputs:
- `recommend` with agreement → PR can proceed to merge gate
- `conditional` or verdict mismatch → human review required
- `blocked` → PR cannot proceed

### Persona C — Merge Gate

Runs immediately before merge.

Responsibilities:
- act as a **thin arbiter**, not a third full evaluator
- verify that the reviewer-side Janus result is acceptable
- check that required mechanical gates passed (build, smoke, any scoped checks)
- refuse merge progression for high-risk categories or unresolved mismatches

Allowed outputs:
- `recommend` → operator may merge
- `conditional` → operator decision required with explicit risk acknowledgment
- `blocked` → merge denied

Non-responsibilities:
- Persona C does **not** reconstruct intent from scratch
- Persona C does **not** produce a third independent Janus verdict in v1
- Persona C only arbitrates Persona B findings plus mechanical gate status

## Workflow

### Stage 1 — Intake

Input: issue, operator request, or maintenance task.

Output: a short markdown change-intent document describing:
- problem
- goal
- constraints
- options or planned change
- unknowns
- decision requested

### Stage 2 — Author Gate

Persona A evaluates the change-intent markdown.

Rules:
- Stage 2 does not start until `npm run check:intake -- <file.md>` passes.
- `blocked` stops automatic PR creation
- `conditional` permits PR creation only if the PR body includes Janus findings
- `recommend` permits normal PR creation

### Stage 3 — Worker Implementation

The worker edits code/docs and opens a PR.

Rules:
- worker must include the author-gate summary in the PR body
- worker must not claim approval authority
- worker must mark self-modifying PRs explicitly

### Stage 4 — Reviewer Gate

Persona B evaluates the PR independently.

Inputs:
- PR diff
- PR body
- an independently generated markdown intent summary

Rules:
- reviewer gate does not rely on `rejected_paths[].name` exact string matching
- reviewer compares by verdict, `best_path`, `violated_principle`, and unresolved unknowns
- mismatch between Author Gate and Reviewer Gate escalates to operator review

### Stage 5 — Merge Gate

Persona C runs after reviewer approval and mechanical checks.

Mechanical preconditions:
- build passes
- smoke fixture / targeted verification passes
- reviewer gate is not `blocked`

Rules:
- merge is never automatic in the first version of this workflow
- operator remains final merge authority
- Persona C is a thin arbiter over Reviewer Gate output + mechanical checks only
- if Persona C sees unresolved material mismatch, it returns `conditional` or `blocked` rather than inventing a third reasoning path

## Self-Modifying PR Escape Hatch

The following changes are considered self-modifying and must bypass automatic Janus approval:
- `src/prompt/**`
- `src/types.ts`
- `src/sampling/aggregator.ts`
- any future file explicitly designated as part of Janus's own gate logic

Mechanical enforcement:
- a path filter runs independently of Janus using staged/PR file paths
- if any changed path matches the self-modifying list, the PR is labeled `janus-self-modifying`
- `janus-self-modifying` forces operator review regardless of persona verdicts
- the path filter result is authoritative even if a Janus persona mistakenly returns `recommend`
- `.janus-self-modifying-paths` is the machine-readable source of truth for the filter

Suggested v1 path filter expression:
- `src/prompt/**`
- `src/types.ts`
- `src/sampling/aggregator.ts`
- `src/parser/output.ts`
- any future file listed in `.janus-self-modifying-paths`

For these PRs:
- Author Gate may still produce findings
- Reviewer Gate may still produce findings
- neither gate may grant automatic approval
- operator review is mandatory before merge

## Decision Logic

## Material Mismatch Rules

Persona A and Persona B are considered materially mismatched if any of the following holds:
- different `decision_status`
- different `best_path.name` after canonical option-label normalization
- Persona B introduces any `critical_unknown` not covered by Persona A and marked `missing_field`, `information_asymmetry`, or `external_dependency`
- Persona B cites a `violated_principle` not surfaced by Persona A
- either side is `blocked`

Persona A and Persona B are **not** materially mismatched when only these differ:
- `rejected_paths[].name` phrasing
- ordering of rejected paths
- wording differences that preserve the same canonical option label and `violated_principle`

Escalation rules:
- any material mismatch forces operator review
- `blocked` on either side prevents merge progression
- repeated non-material naming drift is logged but does not block by itself

### Open PR?
- Author Gate `recommend` → yes
- Author Gate `conditional` → yes, with risk summary
- Author Gate `blocked` → no

### Allow merge consideration?
- Reviewer Gate `recommend` and no major mismatch → yes
- Reviewer Gate `conditional` → operator review required
- Reviewer Gate `blocked` → no

### Merge now?
- Merge Gate `recommend` + mechanical checks green + not self-modifying → operator may merge
- Merge Gate `conditional` → operator explicit acknowledgment required
- Merge Gate `blocked` or self-modifying → no autonomous approval path

## Options

### Option A — Single Janus gate only at PR creation

Simpler, but too vulnerable to self-certification and stale assumptions once the PR evolves.

### Option B — PR Gate + Merge Gate only

Better than A, but still misses the value of an independent reviewer-side Janus voice.

### Option C — Author Gate + Reviewer Gate + Merge Gate

Three Janus checkpoints with distinct roles and explicit human final authority.

## Assumptions

- Persona separation can be implemented as separate Janus-triggered agent contexts, not merely different labels in one shared context.
- A markdown intent summary can represent PR intent well enough for Janus to reason about it.
- The operator is willing to act as final arbiter instead of delegating autonomous merge.

## Unknowns

- Whether the independent Reviewer Gate can reconstruct intent from a complex PR without introducing its own translation drift.
- Whether the three-gate flow is lightweight enough to use routinely rather than only for high-risk changes.
- Whether Persona B can reconstruct intent accurately enough from diff + PR body alone on complex PRs.
- Whether the self-modifying path list will stay complete as Janus evolves.

## Decision requested

Which workflow option is the most robust path for Janus right now, and what conditions must be met before adopting it as the default repo-management flow?
