# AGENTS.md — Janus

Repo-specific notes for AI agents. `README.md` is the product-facing source of truth; this file is the "things you would otherwise get wrong" layer.

## Ground truth hierarchy

When docs disagree, trust in this order:
1. `src/**` (executable)
2. `README.md` (kept current — last updated same day as code)
3. `integrations/**` (current, shipped)
4. `INTEGRATION-MCP-RESERVED.md` — **archival only**. MCP was removed from the shipped surface in 0.1.1 and moved to `reserved/mcp.ts`. The doc still says default backend is `codex` and references `./dist/mcp.js` — both are wrong now. Do not follow its install instructions.

## Repo state gotchas

- **Git is on `main` branch** with GitHub remote at `devonestar/janus`. CI runs on push/PR via `.github/workflows/ci.yml` (build + test + dist/ freshness check across Node 18/20/22). Dependabot is configured for npm + GitHub Actions weekly updates.
- **No linter, no formatter.** Only mechanical gate beyond `tsc` is `npm test` → mock-backend smoke on `fixtures/smoke.md`. It validates output-schema stability, not logic in `parser/`, `sampling/`, or `loop/`.
- **`dist/` is tracked** (intentionally — `bin` resolves to `./dist/index.js`). After editing `src/**`, run `npm run build` and commit the resulting `dist/` in the same change.
- **`prompts/` is still empty.** `fixtures/smoke.md` is the mock-smoke input — keep it passing `recommend/medium` (needs explicit `## Goal`, `## Constraints`, `## NFRs`, `## Options`, `## Assumptions` sections per `src/backend/mock.ts` keyword detection).
- `.janus-self-modifying-paths` is the machine-readable source of truth for paths that must bypass automatic Janus approval. If a gate-critical file changes and this file is not updated, the workflow drifts silently.
- Janus is **CLI-first**. `marketplace/` and `integrations/` are adapter layers, not the product definition. When public docs get fuzzy, bias back toward “the `janus` binary is the product; plugins/skills/hooks are optional”.
- `docs/` and `.sisyphus/evidence/` referenced in `README.md` do **not** exist in the working tree — don't cite paths from them as if they ship.

## Build / run

```bash
npm install
npm run build          # tsc, outputs ./dist (also the only typecheck you get)
npm run dev <args>     # tsx src/index.ts (skip build)
npm link               # exposes `janus` globally; uses ./dist/index.js
npm run check:intake -- <file.md>   # Stage 1 markdown precheck for Context/Problem, Goal, Constraints, Options/Planned Change, Unknowns, Decision requested
npm run self-dev -- <file.md> [backend]   # internal Janus self-dev flow: intake -> eval -> loop -> matching dogfood validator
./dist/index.js eval fixtures/foo.md   # direct invocation, no link
```

- ES module project: `"type": "module"` + `NodeNext`. All intra-`src/` imports must use explicit `.js` extensions even for `.ts` files (NodeNext convention).
- `tsconfig.json` `include` is `src/**/*` only. `reserved/mcp.ts` is **not** compiled — `npm run build` does **not** produce `dist/mcp.js`. If MCP is reinstated, add `reserved/` to `include` or move the file.
- Node: README says 18+, the archival MCP doc says 20+. No `engines` field. If in doubt, test on the higher.

## CLI behavior worth knowing before editing

- `src/index.ts:3` does `delete process.env["CI"]` at startup. This is load-bearing for the `claude` headless backend — do not remove.
- **Default backend is `claude`** (not `codex`). `src/backend/claude.ts` spawns `claude -p --output-format json --model sonnet --no-session-persistence --disable-slash-commands` and parses the envelope's `result` field for an inner JSON blob.
- Default Claude timeout is **240s** (bumped from 120s in 0.2.1 to survive `--samples N` on large docs).
- "Compact" system prompt is only used when backend is `claude | codex | opencode` (`src/index.ts:61,221`). API backends (`openai-api`, `anthropic-api`) get the non-compact prompt.
- `janus gate` returns **FAIL** when `decision_status === "recommend"` but `best_path.robustness_score === "low"` (`src/index.ts:183`). Not just a pass-through of exit codes.
- Exit codes: `0=recommend`, `1=conditional`, `2=blocked`, `3=error` (`src/types.ts` — `EXIT_*`).
- `--samples` is clamped to `[1,5]`; values `>3` print a "NFR ≤3× baseline" warning but proceed.
- Partial variance run on `fixtures/smoke.md` (7 runs of `janus eval --samples 3`) showed **stable `decision_status` + `best_path` but unstable `rejected_paths` naming**. Treat `rejected_paths[].name` as presentation text, not a stable key. For reviewer automation, compare by `violated_principle` and/or canonicalized option labels (`Option A/B/C`), not exact strings.

## Layout (only the non-obvious parts)

```
src/
  index.ts            CLI entry (commander); exit-code + format logic lives here
  backend/            one file per backend, all implement JanusBackend
    interface.ts      JanusBackend + createBackend() switch
    claude.ts         default; shells out to `claude` CLI
    codex.ts, opencode.ts, openai-api.ts, anthropic-api.ts, mock.ts
  prompt/
    system.ts         full system prompt
    system-compact.ts compact variant (CLI backends only)
    output-schema.ts  JSON schema embedded into the prompt
    builder.ts        buildEvalRequest / buildCompareRequest
  parser/output.ts    validateOutput + formatOutput (json|markdown|yaml)
  sampling/aggregator.ts   --samples N consensus (majority vote, conservative tie-break, union of rejections/unknowns)
  loop/engine.ts      `janus loop` Generate→Evaluate→Eliminate→Refine
  types.ts            shared types + EXIT_* constants

integrations/         shipped, non-MCP integration surfaces
  skill/SKILL.md      frontmatter-triggered skill for Claude Code & OpenCode
  codex/              copy-paste for Codex AGENTS.md
  git-hook/pre-commit bash hook; defaults to backend=codex/model=gpt-5.4 (env-overridable)

marketplace/          Claude Code plugin (`claude plugin marketplace add ./marketplace`)
reserved/mcp.ts       archived MCP server; NOT in tsconfig include
```

## Output schema

The parsed response shape (see `types.ts` and `README.md` "What Janus Produces") is load-bearing. Every backend must return an object with at least `decision_status`; parsers reject missing/extra required fields via `validateOutput`. When touching prompts or schemas, regenerate fixtures by hand — there are no golden-file tests.

## Style conventions

- Strict TS, no `any` in new code (the codebase uses `unknown` + narrowing for errors — follow that pattern).
- Error handling in the CLI writes human text to `stderr` and exits with a typed code. Don't `throw` out of command handlers past the top-level `try/catch`.
- Keep principle references P1–P7 exactly as named in `README.md` and `SKILL.md`; the skill's `description` frontmatter is what triggers auto-invocation in Claude Code / OpenCode — don't edit it casually.

## Self-dev pipeline

Janus has a built-in feature development loop: `npm run self-dev -- <spec.md> [backend]`.

### Pipeline stages

```
Stage 1: intake     →  check-intake.mjs   (markdown structure gate)
Stage 2: eval       →  janus eval          (single-shot evaluation)
Stage 3: loop       →  janus loop          (Generate→Evaluate→Eliminate→Refine, max 3 iterations)
Stage 4: validator  →  pattern-matched     (spec-specific dogfood validation)
```

### Validator registry

The pipeline auto-selects a validator based on spec filename:

| Filename pattern | Validator script | What it checks |
|-----------------|-----------------|----------------|
| `/canonical/i` | `scripts/validate-canonical-identity.mjs` | `archetype_slug` / `canonical_key` / `violated_principle` stability across repeated evals on 2 fixtures |
| `/explicit-alternatives\|candidate-path/i` | `scripts/validate-candidate-paths.mjs` | `candidate_paths` presence, cap (≤3), dedup, `fit_summary` length, no `best_path` overlap; runs eval + compare + loop |
| no match | — | prints "no validator configured for this spec yet" |

### When to use self-dev

- **New spec/roadmap document**: always run `npm run self-dev -- <spec.md> claude` before committing
- **Spec edits**: re-run self-dev after significant changes
- **Adding a new validator**: add an entry to `validatorRegistry` in `scripts/self-dev.mjs` with a filename regex and command array

### Variance probe (separate tool)

```bash
scripts/variance.sh [N] [fixture]    # default: N=10, fixture=fixtures/smoke.md
```

Runs `janus eval --samples 3` N times on identical input. Outputs JSONL log + jitter summary to `.janus-variance/`. Gate criterion: >1 disagreement dimension per 10 runs → pin `--samples 1` or `--backend mock`.

### Intake precheck requirements

`npm run check:intake -- <file.md>` requires these markdown headings (case-insensitive):
- `## Context` or `## Problem`
- `## Goal`
- `## Constraints`
- `## Options` or `## Planned Change`
- `## Unknowns`
- `## Decision requested`

Missing any heading → exit 1. Stage 2 (eval) does not start until intake passes.

## When to run Janus on your own changes

Per the dogfood ledger in `README.md`, spec-level changes (anything under a hypothetical `docs/specs/`, or large roadmap edits to `README.md`) are expected to be evaluated with `janus eval` or `janus loop` before merging. Code-only changes in `src/` are not gated.
