# Janus Canonical Rejected-Path Identity — Additive Schema Extension

## Context

Janus has already selected the preferred canonical key direction for rejected-path aggregation:
- `violated_principle`
- plus a normalized path archetype slug

The remaining design question is where this identity should live.

Current state:
- `RejectedPath` currently exposes human-facing fields such as `name`, `rejection_reason`, `violated_principle`, `could_recover`, `recovery_condition`
- aggregation currently depends too much on prose fields
- reviewer automation and future multi-path logic need a stable machine-oriented identity

## Goal

Choose the most robust additive schema change for carrying canonical rejected-path identity without breaking current Janus consumers.

## Constraints

- The change must be additive only.
- Existing human-facing output should remain readable.
- Existing consumers of `name`, `rejection_reason`, and `violated_principle` must continue to work.
- The new identity should reduce dependence on post hoc prose parsing.

## NFRs

- Machine identity should be explicit rather than inferred from display text.
- The design should stay debuggable for maintainers reading raw JSON.
- The extension should preserve room for future multi-path / alternative-generation features.

## Options

### Option A — Add `canonical_key` only

Extend each rejected path with one additive machine field, e.g.
- `canonical_key: "P3:option-b-canonicalize-query"`

Keep `name` as display text.

### Option B — Add `archetype_slug` and derive canonical key from it + `violated_principle`

Extend each rejected path with:
- `archetype_slug`

The canonical key is not stored directly; consumers derive it from `violated_principle + archetype_slug`.

### Option C — Add both `canonical_key` and `archetype_slug`

Extend each rejected path with:
- `canonical_key`
- `archetype_slug`

This makes the machine key explicit while preserving the decomposed parts.

### Option D — No schema change; derive everything in aggregation

Leave the output schema unchanged and compute slugs/keys only in post-processing.

## Assumptions

- Human-facing `name` should remain the display field.
- A stable machine identity should not be hidden entirely in aggregator logic.
- Additive fields are acceptable if they improve long-term reviewer automation and future path-search features.

## Unknowns

- Whether emitting both fields is worth the extra output verbosity.
- Whether LLM backends can produce a stable archetype slug reliably enough, or whether some normalization must still happen in code.
- Whether `canonical_key` should be treated as authoritative if it conflicts with `violated_principle` or `archetype_slug`.

## Decision requested

Which additive schema extension is the most robust path for Janus right now, and what conditions should govern its implementation?
