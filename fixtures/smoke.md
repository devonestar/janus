# Smoke Fixture — Cache Key Strategy

## Context

A small web service caches computed results keyed by user input. Current key is the raw request URL. Observed issue: two users with identical semantic requests but different query-parameter ordering produce separate cache entries, halving hit rate.

## Goal

Pick a cache-key normalization strategy that improves hit rate without introducing new correctness risks.

## Constraints

- Deployed behind a single proxy layer; change must be transparent to clients.
- No migration downtime budget — old and new keys must coexist during rollout.
- Team size: one maintainer; any option requiring per-endpoint schemas is out of reach this quarter.

## NFRs

- Performance: additional key-normalization latency must stay under 1 ms at p99.
- Reliability: cache hit rate should improve, never regress, relative to the raw-URL baseline.
- Observability: the active normalization strategy must be tagged on cache metrics so rollback is measurable.

## Options

### Option A — Sort query parameters alphabetically before hashing

Stable ordering; easy to implement; reversible.

### Option B — Parse and canonicalize query into a structured object, then serialize

Handles type coercion (e.g., `?x=1` vs `?x=01`) and array parameter ordering, but requires a schema per endpoint. No schema exists today.

### Option C — Hash the raw URL unchanged

Status quo. Preserves current behavior; does not fix the hit-rate problem.

## Assumptions

- Clients do not rely on any specific cache-key shape externally.
- Query-parameter reordering is the dominant cause of the halved hit rate, not body or header variation.

## Unknowns

- Whether any downstream system relies on the current cache-key shape.
- Whether duplicate keys from reordering actually cause measurable user-visible latency or just raise cache storage cost.

## Decision requested

Pick A, B, or C with rationale.
