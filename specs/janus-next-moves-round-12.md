# Janus Round 12 — Next Moves After 0.2.1 Publish

## Context

Janus 0.2.1 is about to be published to npm as `janus-gate` (first public release on the registry). Local install and smoke tests pass. SNS operational tooling has been physically separated from the product repo into a sibling directory (`~/projects/janus-ops/`) so the public tarball contains only the CLI product (39.3 kB / 55 files).

This round asks Janus to evaluate what the solo maintainer should focus on for the next ~30 days of the `0.2.x` minor line. Prior rounds 1-11 settled the CLI surface, the `--samples N` equipment, the persona-gating direction, and the README positioning. What they did not settle is where post-publish effort goes first.

## Problem

After the `0.2.1` publish, four candidate directions compete for the maintainer's next ~30 days. Committing to more than one in parallel almost certainly dilutes all of them — past dogfood rounds (Round 8, Round 10) repeatedly favored single-track execution. The risk is picking the most exciting option rather than the one that survives the most failure modes.

## Goal

Name one primary focus for the next ~30 days of the 0.2.x line, with the other three moved to an explicit backlog. "Primary focus" means: the one direction whose first measurable milestone must ship before any of the others are touched.

## Constraints

- Solo maintainer; no team to parallelize across options.
- Default backend must remain `claude` (headless Claude Code CLI, no API key required). Any option that requires paid API keys for end users is out of scope for 0.2.x.
- 0.2.x line is minor-bump only — no breaking changes to CLI flags, exit codes (0/1/2/3), or output schema.
- The public repo must not re-absorb operational SNS code. Any option that requires integrating `janus-ops/` tooling into the public repo is rejected.
- Reversibility preferred (P6): prefer moves whose first milestone can be rolled back or renamed within one minor bump.

## NFRs

- Shipped tarball size must stay under 100 kB.
- `npm test` (mock-backend smoke on `fixtures/smoke.md`) must pass on every commit to `main`.
- Node 18+ compatibility preserved.

## Options

### Option O1 — 48-hour concentrated launch

Within 24 hours of the `0.2.1` publish, post coordinated launch threads on HN, Reddit (`r/programming`, `r/ClaudeAI`), Moltbook (`@janusgate`), Shellbook (`@janusgate`), and X. Primary metric: GitHub stars and npm weekly downloads in the first 7 days. Marketing-first play; no new product code required. Benchmark references in the operational ledger cite OpenClaw (145K stars in 14 days from Moltbook-driven launch) and AFFiNE (28 Trending appearances from a 48-hour push).

### Option O2 — Round 12 persona-gated PR

Implement the direction already chosen by Janus in Round 10 (`specs/janus-persona-pr-merge-gate.md`) — a GitHub integration that auto-posts a Janus verdict as a PR comment and blocks merge when `decision_status` is `blocked`. Product-depth play; adds the first non-CLI surface (a GitHub Action). Ships as a new adapter under `integrations/github-action/`. Round 10 already named three preconditions; all three are currently unmet.

### Option O3 — Stabilization and quality

Ship three concrete internal improvements already named in the roadmap: (a) rejected-path canonicalization under `--samples N` (partial increment is in `bd9c5b6`), (b) `failure_chain` field on rejected paths, (c) moving `opencode`, `openai-api`, and `anthropic-api` backends from "untested" to "verified" in the backend matrix. No new public surface; all changes are internal equipment that existing users benefit from immediately on their next `npm update`.

### Option O4 — Ecosystem integrations

Register a GitHub Action on the Marketplace, publish the Claude Code plugin to a public marketplace entry, and register the skill on ClawHub. Distribution-first play; no new product code, but requires external review cycles (Marketplace listing review can take days to weeks, and the outcome is not controlled by the maintainer).

## Assumptions

- The `npm publish` of `0.2.1` will succeed; this spec assumes the package is live when the round-12 decision is enacted.
- The solo maintainer can sustain roughly 20-30 focused hours over the next 30 days on Janus work (rough order-of-magnitude, not a commitment).
- The four options above enumerate the realistic candidate directions; no additional direction has been surfaced by prior rounds or by the operator.

## Unknowns

- Actual user response to `0.2.1` is unmeasured — no npm download data, no GitHub traffic data, no issue-thread signal exists yet.
- Whether persona-gated PR (O2) is a feature users want, or whether the demand is inferred from internal dogfood rounds only.
- How long Marketplace listing review takes for a brand-new agentic-tool category, and whether rejection would prevent relisting.
- Whether concentrated launch (O1) on platforms where the account (`@janusgate`) has karma 13 and 4 followers produces measurable reach, or whether the karma floor gates distribution.

## Decision requested

Pick one of O1, O2, O3, O4 as the primary focus for the next ~30 days of `0.2.x`. The other three must be named in the `rejected_paths` output with the principle violated and, where applicable, the condition under which each could be revisited.
