# Janus Publishing Checklist

This file is for the first public push and for future public releases.

## Product statement to keep fixed

Use this exact framing unless the product itself changes:

- **Janus — AI-native decision gate**
- **CLI-first tool**
- Optional adapters: plugin / skill / hook
- Do **not** describe Janus as a future simulator or prediction engine

## Pre-publish checklist

Run these before pushing to the public repository:

1. **Working tree sanity**
   - `git status`
   - confirm no accidental local files, credentials, or scratch outputs are staged

2. **Build + smoke**
   - `npm run build`
   - `npm test`

3. **Publish-safe content scan**
   - confirm README does not contain local absolute paths
   - confirm no stale private/internal references are left in public-facing docs
   - confirm plugin/package metadata still point at `devonestar/janus`

4. **CLI-first positioning check**
   - README headline and intro still describe Janus as CLI-first
   - package description matches the same positioning
   - marketplace/plugin metadata do not imply plugin-first packaging

5. **License / metadata check**
   - `LICENSE` present
   - `package.json` has `license`, `repository`, `homepage`, `bugs`

6. **Public repo surface**
   - GitHub repo description matches the current product statement
   - default branch strategy is known (`master` today unless changed intentionally)

## Public / private scope

| Scope item | Public now? | Notes |
|---|---|---|
| CLI core (`eval`, `compare`, `gate`, `loop`) | Yes | This is the product surface today. |
| Structured outputs (`decision_status`, `best_path`, `rejected_paths`, `critical_unknowns`) | Yes | Stable enough to document publicly. |
| Optional integrations (`marketplace/`, `integrations/`) | Yes | Position as adapters on top of the CLI. |
| Sampling / variance behavior | Yes, with care | Publicly describe as confidence/variance equipment, not future simulation. |
| Canonical rejected-path identity work | Yes, but experimental framing | Fine to mention as current internal improvement; do not oversell as fully stable across all backends yet. |
| Honest-futures / many-futures brand line | Yes, as brand sub-line | Keep it metaphorical until the harness earns it structurally. |
| Persona-gated PR / merge workflow | Not as current product surface | Keep as roadmap/experimental design, not shipped feature. |
| Literal future-simulation claims | No | Not supported by the current harness. |
| Server-first / hosted-platform positioning | No | Conflicts with current CLI-first product truth. |

## Release posture

For the current repo state, the safe public message is:

> Janus is a CLI-first AI-native decision gate for PRD/spec markdown.
> It surfaces robust paths, rejected paths, and critical unknowns before implementation.

Everything beyond that should be presented as either:
- current internal harness evolution, or
- future roadmap

—not as already-finished product reality.
