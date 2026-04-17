# Janus Canonical Rejected-Path Key Design

## Context

Janus sampling currently aggregates rejected paths in `src/sampling/aggregator.ts` by `rp.name.trim()`. This causes phrasing drift to appear as multiple rejected paths even when verdict and winning path stay stable.

We already know this is the wrong stability boundary for reviewer automation and for Janus's future-facing multi-path branding.

The design problem is: what key should Janus use to identify "the same rejected path" across sampled runs without collapsing truly different rejected paths into one bucket?

## Goal

Pick the most robust canonical key design for rejected-path aggregation so Janus can unify semantically identical rejected paths across sampling while preserving meaningful distinctions.

## Constraints

- The key must be more stable than the current free-text `name` field.
- The key must not silently merge clearly different rejected paths.
- The design should fit the existing output model incrementally.
- The chosen design should still allow a human-friendly display name to be shown separately.

## NFRs

- Reviewer automation should not rely on unstable display strings.
- The key should be explainable and debuggable by maintainers.
- The implementation should be additive and reversible.

## Options

### Option A — Normalized name only

Lowercase, trim, collapse punctuation/whitespace, maybe strip filler words, and use the normalized result as the key.

### Option B — Principle code + normalized path archetype slug

Create a canonical key from:
- `violated_principle`
- a normalized archetype slug derived from the path identity (for example `option-b-canonicalize-structured-query`)

Store the display name separately.

### Option C — Principle code only

Use only `violated_principle` as the canonical key.

### Option D — Hash the full rejected-path object

Hash `name + rejection_reason + violated_principle + recovery_condition` into a stable key.

## Assumptions

- Different rejected paths can share the same violated principle, so principle alone is unlikely to be enough.
- Path identity matters more than exact prose.
- A human-facing display name can be selected independently from the canonical key.

## Unknowns

- How reliable a generated archetype slug would be across backends and prompt phrasing.
- Whether some documents name options too weakly for stable slug extraction.
- Whether a schema extension is needed to carry an explicit canonical key or archetype field instead of deriving it post hoc.

## Decision requested

Which canonical rejected-path key design is the most robust path for Janus right now, and what conditions should bound its implementation?
