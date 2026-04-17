# Validation Fixture — Generic Option Names

## Context

A team must reduce compute cost from an expensive batch pipeline without degrading daily report accuracy. Several ideas exist, but the proposal names them weakly.

## Goal

Choose the most robust cost-reduction path.

## Constraints

- Daily reporting cannot miss its morning SLA.
- The team cannot rewrite the whole pipeline this quarter.
- Rollback must be possible within one day.

## NFRs

- Compute spend should drop materially within one quarter.
- Accuracy regressions are unacceptable.
- On-call burden must not increase.

## Options

### Option A — Do nothing

Keep the current pipeline unchanged and hope natural usage drops cost pressure.

### Option B — Status quo with selective tuning

Keep the same architecture, but tune the heaviest batch steps and reduce over-processing.

### Option C — No change except schedule shifts

Keep the pipeline logic the same, but move some jobs to cheaper time windows.

### Option D — Replace the pipeline with a streaming rewrite

Build a new streaming path to eliminate redundant recomputation entirely.

## Assumptions

- Cost pressure comes mainly from redundant batch work, not from inaccurate capacity planning.
- Schedule shifts alone do not fundamentally reduce total compute consumed.

## Unknowns

- Whether tuning alone can achieve enough savings.
- Whether the streaming rewrite can be staffed safely this quarter.

## Decision requested

Pick the most robust option.
