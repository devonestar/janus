# Janus

> Named after the Roman god of gates and beginnings, whose two faces look simultaneously at the past and the future.

**Stop shipping fragile plans.** Janus reads your PRD, spec, or design doc and tells you which paths will break, which unknowns you're ignoring, and whether you should proceed.

```bash
janus eval my-spec.md
# => recommend | conditional | blocked
```

---

## When to Use Janus

Use Janus **before committing to a plan** — not after.

- You're about to merge a PRD that will drive weeks of implementation
- You're picking between two architecture options and need a structured tiebreaker
- You're shipping a spec that locks in an irreversible technical choice
- You need a pre-commit gate that blocks fragile specs from entering the codebase
- Your AI agent is about to finalize a design doc and needs a second opinion

## When NOT to Use Janus

- Routine code reviews (use your linter and code review tools)
- Freeform brainstorming (too early for evaluation)
- JSON schema validation (use ajv or zod)
- Simple questions or clarifications

---

## Quick Start

```bash
git clone https://github.com/devonestar/janus.git
cd janus
npm install && npm run build
npm link    # exposes `janus` globally

janus eval your-spec.md
```

Janus returns one of three verdicts:

| Verdict | Exit Code | Meaning |
|---------|-----------|---------|
| `recommend` | 0 | Safe to proceed |
| `conditional` | 1 | Proceed only after resolving named unknowns |
| `blocked` | 2 | Stop. Critical issues found |

Every verdict includes: `best_path` (what to do), `rejected_paths` (what not to do and why), and `critical_unknowns` (what you don't know yet).

---

## See It In Action

Below is a real verdict Janus produced on one of its own design documents — Round 10 of its dogfood series. The document was a roadmap that proposed five different ways to add named personas to Janus's evaluation pipeline. Janus was asked which one to build.

```
decision_status:     conditional
information_quality: degraded
best_path:           SUPPRESSED (below exact-match quorum)

rejected_paths:
  * Option P -- Parallel Specialists + Synthesizer     -> violates P1
    "The synthesizer is itself an LLM call that can invent content
     not present in any persona's output."
  * Option R -- Red-Team vs Blue-Team                   -> violates P1
    "The adjudicator inherits the same defect; also fails to scale
     past two voices."
  * Option S -- Principle-Sharded (P1-P7)               -> violates P3
    "7 LLM calls x 3 min = 21 min, breaks the cost-ceiling NFR.
     Principles are not orthogonal -- 7 critiques are partially redundant."
  * Option T -- System-Prompt Shape Only                -> violates P2
    "Ships as 'persona equipment' but delivers single-voice-with-pose.
     The framing itself is a P2 violation."

critical_unknowns:
  * U-1: The aggregator was validated for homogeneous variance.
         Personas inject heterogeneous prompts -- is 2/3 agreement
         consensus, or one persona having a different prior?
  * U-2: No fixture proves personas find rejections that --samples
         3 cannot. The hypothesis is untested.

variance_report:
  * 3/3 samples agreed on "conditional"
  * 3 samples produced three different phrasings of the same winner
  * Quorum rule refused to name a best_path from a renaming artifact
```

Four observations about what just happened:

1. **Janus did not name a winner.** Three samples agreed on what should win, but each sample phrased the name differently. Rather than pick one phrasing and pretend consensus, Janus suppressed the field. This is **P7 -- Abstention Is Correct Behavior** acting against Janus's own convenience.
2. **Every rejection cites a principle.** No path was rejected for being "bad" -- each failed a specific test (P1, P2, P3). An operator reading this can argue with the principle citation, not with Janus's taste.
3. **The critical unknowns are honest.** U-1 is a load-bearing doubt about whether Janus's own equipment (variance sampling) works on heterogeneous inputs. Janus raised it against the very round that wanted to ship that equipment.
4. **The verdict is `conditional`, not `recommend`.** Janus sees a winner but names preconditions before implementation may proceed. A `recommend` here would have been fragile; `blocked` would have been excessive. The middle status is the one that matches the evidence.

Janus evaluated its own roadmap, rejected four of five options against its own seven principles, refused to claim certainty, and named the conditions under which it would be willing to proceed. That is the tool, in one page.

---

## The Seven Principles

Every Janus verdict is traceable to one of these. An agent reading Janus output should respect the cited principle before overriding it.

1. **P1 -- No Certainty Without Evidence.** No exact probabilities, only conditional language. Rejections say *could* violate, not *will*. If Janus has not seen evidence for a claim, the claim is not made.
2. **P2 -- Unknowns Are First-Class.** Missing information is surfaced as a named unknown, not silently filled in. If Janus has to assume something to reach a verdict, the assumption is listed where a reader can audit it.
3. **P3 -- Robustness Over Optimism.** Of two paths, the one that survives more failure modes wins. Ambition that has not been stress-tested loses to less ambitious paths that have been.
4. **P4 -- Conflict Is a Rejection Signal.** Contradicting constraints invalidate every path that depends on both. Janus reads the document looking for internal inconsistency and treats it as grounds for rejection, not a puzzle to solve.
5. **P5 -- Scope Discipline.** Janus evaluates only what the document says, not what the reader wishes it said. Opinions on adjacent topics are suppressed.
6. **P6 -- Reversibility Preference.** Paths that preserve the ability to change course beat paths that do not. Irreversible commitments under uncertainty are downgraded.
7. **P7 -- Abstention Is Correct Behavior.** `blocked` is a valid output, not a failure. Suppressed `best_path` is a valid output, not a gap. Refusing to answer is sometimes the most informative thing Janus can do.

---

## CLI Usage

```bash
# Single-shot evaluation
janus eval my-prd.md

# Variance sampling -- run N times, return consensus
janus eval my-prd.md --samples 3

# Compare two options
janus compare option-a.md option-b.md

# Autonomous Generate-Evaluate-Eliminate-Refine loop
janus loop draft.md --max-iterations 3

# CI/CD binary gate (exit 0 = pass, non-zero = fail)
janus gate pr-spec.md
```

### Flags

- `--backend <name>` -- `claude` (default), `codex`, `opencode`, `openai-api`, `anthropic-api`, `mock`
- `--model <id>` -- override backend model. Omit to honor the backend's own config
- `--format <fmt>` -- `json`, `markdown`, `yaml`
- `--samples <N>` (eval only, v0.2.0+) -- run N times, return consensus. N in [1, 5]. Linear runtime cost.
- `--max-iterations <N>` (loop only)

---

## What Janus Produces

Every `janus eval` or `janus compare` returns a JSON object with this shape:

```ts
{
  decision_status: "recommend" | "conditional" | "blocked",
  best_path: {
    name: string,
    rationale: string,
    enabling_conditions: string[],
    fragility_warnings: string[],
    robustness_score: "low" | "medium" | "high"
  } | null,
  rejected_paths: [{
    name: string,
    rejection_reason: string,
    violated_principle: "P1" | "P2" | ... | "P7" | null,
    could_recover: boolean,
    recovery_condition: string | null
  }],
  critical_unknowns: [{
    id: string,
    description: string,
    impact: string,
    question_for_human: string | null,
    source: "missing_field" | "inferred_assumption" | "information_asymmetry" | "external_dependency"
  }],
  assumptions: [...],
  information_quality: "sufficient" | "degraded" | "insufficient",
  next_actions: [{ priority: "critical"|"high"|"medium", action: string, addresses: string }],
  variance_report?: {              // present only when --samples > 1
    samples: number,
    decision_status_trace: DecisionStatus[],
    decision_status_agreement: number,
    best_path_agreement: number | null,
    tie_broken_to: DecisionStatus | null,
    rejected_path_frequency: Record<string, number>,
    critical_unknown_frequency: Record<string, number>,
    per_sample_errors: (string | null)[]
  }
}
```

---

## Quick Facts

| Field | Value |
|-------|-------|
| Current version | `0.2.1` |
| Binary | `janus` (on `$PATH` after `npm link`) |
| Default backend | `claude` (headless Claude Code CLI -- no API key) |
| Commands | `eval`, `compare`, `gate`, `loop` |
| Output formats | `json` (default off-TTY), `markdown` (default on TTY), `yaml` |
| Exit codes | `0=recommend`, `1=conditional`, `2=blocked`, `3=error` |
| Requires | Node 18+, TypeScript, one of: Claude Code CLI / Codex CLI / OpenAI API key / Anthropic API key |
| Source | `https://github.com/devonestar/janus` |
| Repo layout | `src/` (TS), `dist/` (built JS), `specs/` (internal design docs), `marketplace/` (plugin), `integrations/` (skill + hook + AGENTS) |

---

## Backends

| Backend | Status | Notes |
|---------|--------|-------|
| `claude` (default) | verified | Local Claude Code CLI, headless (`-p --output-format json`). Uses subscription, no API key. |
| `codex` | verified | Local Codex CLI. Honors `~/.codex/config.toml` default model unless `--model` given. |
| `opencode` | untested | Local OpenCode CLI. |
| `openai-api` | untested | Needs `OPENAI_API_KEY`. |
| `anthropic-api` | untested | Needs `ANTHROPIC_API_KEY`. |
| `mock` | verified | Rule-based, no LLM. For fast CI and structural checks. |

### Cost notes

On the default `claude` headless backend:
- Short fixture (< 1 KB): ~40 s per eval
- Typical PRD (5-10 KB): ~1-2 min per eval
- Large roadmap (15+ KB): ~2-3 min per eval
- `--samples N` multiplies wall-clock by N (serial). Default timeout is 240 s per call.

Use `--backend mock` when you want structure-only checks with no LLM cost.

---

## Agent Integration

Janus is consumed by other agents via the plain CLI -- no MCP needed.

These are **optional adapters on top of the CLI product**.

### Option 1 -- Claude Code plugin

```bash
claude plugin marketplace add ./marketplace
claude plugin install janus@janus-local
```

After a session restart, Claude Code auto-triggers the `janus` skill on PRD/spec work.

### Option 2 -- Global CLAUDE.md snippet

Copy the `JANUS_PROMPT_BLOCK` from `integrations/skill/SKILL.md` into your `~/.claude/CLAUDE.md`.

### Option 3 -- Codex CLI / OpenCode / Git hook

- **Codex CLI**: paste `integrations/codex/project-instructions.md` into your project's `AGENTS.md`
- **OpenCode**: install `integrations/skill/SKILL.md` at `~/.config/opencode/skills/janus/SKILL.md`
- **Git pre-commit gate**: copy `integrations/git-hook/pre-commit` to `.git/hooks/pre-commit`

MCP server implementation is archived under `reserved/mcp.ts` and can be reinstated if needed.

---

## Self-Dev Pipeline

Janus includes a built-in feature development loop for spec-driven work:

```bash
# Full pipeline: intake check -> eval -> loop -> validator
npm run self-dev -- my-spec.md claude

# Intake structure check only
npm run check:intake -- my-spec.md

# Variance probe: run --samples 3 N times, measure jitter
scripts/variance.sh 10 fixtures/smoke.md
```

The self-dev pipeline runs four stages in sequence:

1. **Intake** -- verifies the spec has required headings (Context/Problem, Goal, Constraints, Options, Unknowns, Decision requested)
2. **Eval** -- single-shot `janus eval` on the spec
3. **Loop** -- `janus loop --max-iterations 3` for autonomous refinement
4. **Validator** -- auto-selected by filename pattern (canonical identity, candidate paths, or none)

Validators are registered in `scripts/self-dev.mjs`. To add a new one, add an entry to `validatorRegistry` with a filename regex and command array.

---

## Dogfood Ledger

Janus has been self-evaluated eleven times. Each round Janus evaluates one of its own design documents, applies its own principles, and the result drives the next change.

| Round | Focus | Outcome |
|-------|-------|---------|
| 1 | Initial self-eval | Found internal P4 contradiction in own spec |
| 2 | Remediation | First `recommend` + first `loop success` |
| 3 | Robustness | First `high` robustness verdict; inline-summary pattern proven |
| 4 | Rename Agamoto -> Janus | Verified functionally equivalent |
| 5 | Self-future decision | Janus picked its own next step, executed it |
| 6 | MCP integration | Built and verified, then archived per operator preference |
| 7 | Non-MCP integration | Skill + git-hook + Codex-AGENTS path shipped |
| 8 | Equipment roadmap | Janus chose variance-sampling (Option G) over 3 alternatives |
| 9 | Ship sampling | v0.2.0 with `--samples N`; discovered unknown-coverage is the larger value |
| 10 | Persona roadmap | Janus picked Q x Source-C; rejected 7 alternatives; named 3 preconditions for Round 11 |
| 11 | README storytelling | Janus picked Option E (Concrete-Evidence-First); rejected 3 alternatives including metaphor-first |

---

## Roadmap

Current public surface:

- `eval`, `compare`, `loop`, `gate`
- `--samples N` consensus sampling on `eval`
- CLI-first integrations under `integrations/`
- self-dev pipeline (`npm run self-dev`) for spec-driven feature development
- archived MCP implementation under `reserved/mcp.ts` (not part of the shipped surface)

Work in progress / not yet shipped:

- persona-gated PR / merge workflow
- rejected-path canonicalization under sampling (first increment shipped in `bd9c5b6`)
- failure future narratives (`failure_chain` field on rejected paths)

---

## Changelog

- **0.2.1** -- Fix: default `claude` backend timeout 120 s -> 240 s. Previously long docs (> 10 KB) could SIGTERM under samples.
- **0.2.0** -- Feature: `--samples N` on `janus eval`. New optional `variance_report` output field. Deterministic aggregation (majority vote + conservative tie-break + union of rejections/unknowns).
- **0.1.1** -- Internal: removed MCP from shipped surface (archived under `reserved/`). Default backend switched to `claude` headless.
- **0.1.0** -- Initial dogfood-verified CLI: `eval` / `compare` / `loop` / `gate`.

---

## Reading Guide

- **If you are an agent picking up this README as context**: extract the "When to Use" section, the Quick Start, the seven principles, the output schema, and the exit codes. Those let you invoke Janus correctly and interpret its output.
- **If you are a human first-reader**: the "See It In Action" block is the shortest honest answer to "what does this tool actually do." Read that, then the principles, and you have the philosophy. Everything after is mechanics.
- **If you are evaluating adoption**: decide whether the seven principles match your team's failure modes. If they do, the rest is integration detail. If they don't, no amount of README polish will fix that.

---

## License

MIT.
