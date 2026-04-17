# Janus Contract — Explicit Alternatives / Candidate Paths

## Context

Janus has already selected explicit alternatives / path decomposition as the next roadmap step, but blocked implementation on three design unknowns:
- where alternatives should live in the output contract
- how boundedness should be enforced
- what minimum document structure should trigger alternatives vs suppression

Janus is still a CLI-first decision gate. This contract must preserve that truth.

## Goal

Fix the output contract and gating rules for explicit alternatives so Janus can implement the next increment without drifting into theatrical complexity.

## Constraints

- The change must be additive to the current output contract.
- The feature must remain bounded and inspectable.
- The activation/suppression rule must be structural, not left to model discretion.
- The change must preserve existing `best_path`, `rejected_paths`, `critical_unknowns`, and `next_actions` behavior.

## NFRs

- Thin documents should surface useful candidate paths rather than only a single recommendation.
- Well-specified documents should not get noisy extra alternatives.
- Existing CLI consumers should keep working if they ignore the new field.

## Options

### Option A — Add a new top-level `candidate_paths` field with hard bounds and activation rule

Add an additive top-level field:
- `candidate_paths?: CandidatePath[]`

Each `CandidatePath` would contain:
- `name`
- `origin` (`document` | `generated` | `decomposed`)
- `rationale`
- `fit_summary`
- `archetype_slug`

Contract rules:
- surface only when `named_options_count < 2`
- hard cap: `candidate_paths.length <= 3`
- suppress entirely when goals are missing or information_quality would otherwise be `blocked`
- generated candidates must be explicitly labeled as non-document-native

### Option B — Extend `rejected_paths` to carry implicit alternatives

Do not add a new field. Continue to infer candidate-path structure from `best_path + rejected_paths + rejected-path identity`.

### Option C — Add alternatives as a sub-field under `best_path`

Attach something like:
- `best_path.alternative_set`

This keeps all path information under the winning path.

## Assumptions

- A top-level field is easier for CLI consumers to ignore safely than a structural rewrite of existing fields.
- Three candidates are enough for an initial bounded increment.
- `named_options_count < 2` is a reasonable first activation threshold for thin documents.

## Unknowns

- Whether `fit_summary` is the right minimal explanatory field for candidate paths.
- Whether `information_quality === degraded` but not blocked is sufficient to allow generated candidates.
- Whether compare/loop should surface `candidate_paths` identically or with mode-specific differences.

## Decision requested

Which contract is the most robust path for Janus right now, and are the proposed boundedness + activation rules strong enough to start implementation?
