# Candidate Path Rich Fixture

## Goal

Reduce flaky deploys without a major rewrite.

## Constraints

- One maintainer
- No large architectural rewrite this quarter

## NFRs

- Reliability must improve
- Rollback must stay simple

## Options

### Option A — Stabilize the deployment scripts

Tighten retries, health checks, and rollback discipline in the current path.

### Option B — Rebuild the deployment orchestration layer

Replace the current deployment flow with a more ambitious orchestration rewrite.

## Assumptions

- Most flakes come from a small number of unstable steps

## Decision requested

Pick the most robust path.
