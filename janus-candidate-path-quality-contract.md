# Janus Contract — Candidate Paths Quality

## Context

Janus now supports eval-only `candidate_paths` for thin documents. The current contract establishes:
- additive top-level `candidate_paths`
- hard cap of 3
- structural activation for thin documents
- suppression in compare and loop for now

That is enough to surface alternatives, but not enough to make those alternatives trustworthy for public-facing claims. Before Janus can present candidate paths as a meaningful product capability, it needs a clearer quality contract.

## Goal

Define the minimum quality bar for `candidate_paths` so Janus can surface them publicly without turning them into noisy or theatrical output.

## Constraints

- The contract must preserve Janus as a CLI-first decision gate.
- The contract must remain additive to the current output model.
- Quality rules must be inspectable and enforceable, not only stylistic guidance.
- The contract must preserve provenance honesty: users must be able to tell whether a candidate came from the document or from Janus.

## NFRs

- Reliability: candidate paths should be distinct enough to help an operator reason about alternatives.
- Observability: candidate paths should stay short and readable in CLI output.
- Reliability: candidate paths should not duplicate the best path or each other under trivial wording changes.

## Options

### Option A — Keep the current minimal contract

Rely on the existing bounded count and provenance labels, and defer stricter quality rules until real usage reveals problems.

### Option B — Add an explicit candidate-path quality contract

Define concrete rules for:
- provenance labeling (`document` | `generated` | `decomposed`)
- maximum `fit_summary` length
- minimum distinction between candidates
- duplicate/near-duplicate suppression
- best-path duplication suppression

### Option C — Remove candidate_paths from public-facing output until a later redesign

Keep the feature internal-only until Janus has a more powerful scenario engine.

## Assumptions

- Public users will judge Janus by the quality of surfaced alternatives, not just by the existence of the field.
- A small explicit quality contract can improve trust without requiring a major redesign.
- Candidate paths are still worth shipping incrementally if their quality bar is clear.

## Unknowns

- What minimal distinction rule is strong enough to prevent near-duplicate candidates without overfitting to current fixtures.
- Whether fit-summary quality should be enforced in code, prompt, or both.
- Whether public-facing docs should describe candidate_paths as experimental until the quality contract is enforced in code.

## Decision requested

Which path is the most robust way to make `candidate_paths` public-safe, and what exact quality rules should Janus require next?
