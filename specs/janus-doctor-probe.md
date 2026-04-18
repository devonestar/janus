# Janus Doctor — --probe Flag + Exit Code + JSON Output

## Context

`janus doctor` shipped in v0.3.0 with structural-only backend checks (`which claude`, env var presence). Two gaps remain:

1. **False positives**: structural ✓ does not guarantee the backend actually works at runtime. A user with claude installed but not logged in sees ✓ and discovers the failure only when running eval.
2. **Exit code blindness**: doctor exits 0 if any backend is structurally available, making CI consumption unreliable — a pipeline cannot distinguish "all backends broken" from "all backends healthy" via exit code alone.
3. **No machine-readable output**: `--format json` is not supported on doctor, violating C-4 from the roadmap constraint set.

Doom Gate evaluation (Round 13 followup) identified D-2 as the highest-risk gap: adding a probe without fixing exit codes makes the probe invisible to CI consumers.

## Goal

Ship three improvements to `janus doctor` in one cycle:
1. `--probe` flag: opt-in functional verification per available backend using a minimal fixed prompt
2. Exit code update: when `--probe` is active and all probed backends fail, exit non-zero
3. `--format json`: machine-readable doctor output for CI/scripting

## Constraints

- C-1: No new npm dependencies.
- C-2: Default doctor (no --probe) must remain under 500ms. Probe mode under 5s total (parallel execution).
- C-3: Functional probe is opt-in only — default doctor behavior must not change.
- C-4: `--format json` output must be parseable and include per-backend status + overall result.
- C-5: Single maintainer, one cycle scope.
- C-6: Probe must not break existing `npm test` (which calls `./dist/index.js doctor` without --probe).

## NFRs

- Probe prompt: fixed string, minimal — e.g. `"respond with the single word: ok"` — not a full eval request.
- Probe timeout per backend: 10s maximum (separate from eval's 240s).
- Probe result: pass if response is non-empty and non-error; fail if timeout, error, or empty.
- Exit codes: 0 = at least one backend healthy (structural or probe), 1 = no backends available or all probed backends failed, 3 = internal error.
- JSON output shape: `{ node_version, node_ok, backends: [{name, available, probe_result?, hint?}], available_count, ready }`.

## Options

### Option A — Implement all three in one PR (--probe + exit codes + JSON)

Add `--probe` flag to doctor command. When set: run structural check first, then for each structurally available backend run a minimal timed prompt. Update exit code logic to exit 1 when `--probe` is active and zero backends pass the probe. Add `--format json` independently of `--probe` (JSON works with or without probe).

- Satisfies all constraints in one cycle
- D (JSON) is bundled as mandated by the Doom Gate finding
- Risk: slightly larger change surface for a single maintainer

### Option B — Ship --probe and exit codes only, defer JSON to next cycle

Implement --probe + exit code fix now. Defer --format json to a follow-on. Smaller scope per cycle.

- Leaves C-4 unmet for another cycle
- Doom Gate D-5 explicitly warned against deferring JSON as "optional"
- Violates the Doom Gate mandate to bundle D with the primary option

### Option C — Ship JSON only, defer --probe

Add `--format json` now. Defer probe to next cycle.

- Satisfies C-4 immediately
- Leaves the false-positive and exit code gaps open
- Does not address the highest-friction user problem (D-2 from Doom Gate)

## Assumptions

- A-1: Parallel probe execution across available backends completes within 5s under normal conditions (U-3 from prior eval).
- A-2: A minimal fixed prompt (`"respond with the single word: ok"`) reliably distinguishes working from broken for claude and openai-api backends. codex and opencode behavior under this prompt requires empirical validation before shipping.
- A-3: Exit code 1 for "all probed backends failed" is the correct signal — not a new code, reuse of EXIT_CONDITIONAL (1).
- A-4: JSON output without --probe shows structural availability only; JSON output with --probe includes probe results. The same --format flag works for both.

## Unknowns

- U-1: Whether codex and opencode return non-empty output for the minimal probe prompt in a broken state (misconfigured model, no auth). If yes, the probe gives false positives for those backends.
- U-2: Whether 10s per-backend probe timeout is sufficient for all backends under realistic conditions, or whether some backends (opencode) have higher cold-start latency.

## Decision requested

Which option should be implemented, and what conditions must be met before the probe is considered reliable for codex and opencode backends?
