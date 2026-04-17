# Validation Fixture — Query Canonicalization Stability

## Context

An internal API cache currently keys responses by the raw request URL. Equivalent requests with reordered query parameters create duplicate entries, reducing hit rate and obscuring observability.

## Goal

Choose the safest cache-key strategy for improving hit rate while preserving correctness.

## Constraints

- Team size is one maintainer.
- No endpoint-specific schema registry exists.
- Rollout must be reversible without downtime.

## NFRs

- p99 added latency must stay below 1 ms.
- Cache hit rate must improve relative to the raw-URL baseline.
- The chosen strategy must remain observable and rollback-friendly.

## Options

### Option A — Sort query parameters alphabetically before hashing

Simple, reversible, and compatible with the current rollout constraints.

### Option B — Parse and canonicalize query parameters into a structured object, then serialize

Potentially more correct, but it requires endpoint-specific schemas and stronger assumptions about query semantics.

### Option C — Keep hashing the raw URL unchanged

Preserves current behavior, but keeps duplicate-cache-key waste in place.

## Assumptions

- Query-parameter order is the dominant source of duplicate cache entries.
- Clients do not rely on any specific cache-key shape.

## Unknowns

- Whether any downstream integration depends on the current raw-key shape.
- Whether array parameters have ordering semantics that the simple sort would mishandle.

## Decision requested

Pick the most robust option.
