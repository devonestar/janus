# Janus v0.3.2 — Publish Readiness

## Context

Janus is a CLI-first AI-native decision gate for PRD/spec markdown. The current codebase is at v0.3.2 and includes the following recent additions that are candidates for an npm publish:

1. **`janus harness <file>`** — 3-pass structured evaluation pipeline:
   - Pass 1: standard eval extracting `best_path.enabling_conditions` (EC-1…N)
   - Pass 2: targeted doom — adversarial scenarios that explicitly attack each EC
   - Pass 3: deterministic crosscheck matrix → `condition_survival_rate` + `harness_verdict`
   - Verdict: any fatal doom scenario on an EC → blocked; <50% coverage → conditional; else inherits eval

2. **`janus loop --harness`** — harness-aware refinement loop:
   - Runs harness, extracts fatal+uncovered conditions
   - LLM refiner in patch mode: revises only failing sections
   - Convergence: score = fatal×2 + uncovered, non_convergence on 3-iteration plateau
   - Best-iteration tracking with tie-break by earlier index
   - File safety: realpath-based write guard, never overwrites input

3. **`src/loop/convergence.ts`** — pure termination function shared by both loop engines

4. **`src/prompt/doom-targeted.ts`** — targeted doom prompt with EC-injection

5. **`src/prompt/refiner.ts`** — patch-mode refiner prompt

## Publish constraints

- npm publish to janus-gate package (public)
- Target users: engineers using Janus as a CLI gate in CI or local spec review
- Node 18/20/22 CI matrix passing
- dist/ is tracked and freshness-checked in CI
- No breaking changes to existing commands (eval, doom, compare, gate, loop, doctor)
- All new features are additive (new commands or new flags on existing commands)

## NFRs for publish

- `janus harness` must work with opencode backend (the primary available backend in the current environment)
- `janus loop --harness` must not break existing `janus loop` behavior (backward compat)
- No new required env vars or API keys
- Package size increase must be reasonable (no new heavy dependencies)
- TypeScript strict mode, no `any`, all dist/ built and committed

## Options

### Option A — Publish now as v0.3.2

Ship the current codebase with harness + harness-loop as documented. Tag v0.3.2, push to npm.

### Option B — Publish as v0.4.0 (minor bump for new commands)

The addition of `janus harness` and `janus loop --harness` represents meaningful new capability. Bump to v0.4.0 following semver minor convention.

### Option C — Hold publish; address unknowns first

Defer publish until the two open unknowns (refiner drift risk, opencode subprocess reliability in the harness-loop path) are empirically validated on real-world specs.

## Assumptions

- The harness pipeline (Pass 1-3) has been validated through dogfood on multiple internal specs.
- The targeted doom prompt produces measurably better EC coverage than general doom (validated by EC-1 A/B experiment: 100% vs 0%).
- The existing smoke test suite (mock backend eval + doctor) passes and the CI matrix is green.
- No external consumers of the janus-gate npm package are known to be broken by the new additions (they are additive).

## Unknowns

- Whether `janus loop --harness` produces reliable convergence on real-world specs beyond the internal dogfood cases.
- Whether the LLM refiner in patch mode reliably avoids scope drift in production use.
- Whether opencode's subprocess stdout behavior (previously unreliable when spawned from Node.js) is stable enough for harness-loop production use.
- Whether the version number (0.3.2 vs 0.4.0) aligns with user expectations for the scope of new features.

## Decision requested

Is the current codebase ready to publish? If yes, which version number? If no, what must be resolved first?
