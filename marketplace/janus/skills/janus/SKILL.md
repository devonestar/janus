---
name: janus
description: Evaluate PRD/spec markdown documents with Janus before committing to a plan. Use when the user asks to review a spec, finalize a PRD, approve a design, prep for a planning meeting, or commit to irreversible work. Janus returns structured rejected_paths (with principle violations P1-P7) and critical_unknowns that the agent should surface to the user before proceeding. Not needed for routine code edits or simple questions.
---

# Janus — Pre-Decision Evaluation Gate

Janus is a CLI tool installed locally (`janus` binary). It is the "two-faced gate" that looks at both the present state of a document and the possible failure futures, rejecting fragile paths and recommending the most robust surviving one.

## When to invoke this skill

Trigger Janus when you (the agent) are about to help the user finalize any of these:

- A Product Requirements Document (PRD) that will drive implementation work
- An Architecture Decision Record (ADR) or technical design doc
- A project plan or roadmap that locks in scope, deadlines, or resources
- A spec change that will be merged and acted on
- A comparison between two or more design options

Do NOT invoke Janus for:
- Code-level edits that do not change stated requirements
- Simple questions or clarifications
- Documents that are still in freeform brainstorming stage

## How to invoke

Janus is a local CLI. Use the agent's Bash/shell tool.

### Evaluate a single spec (recommended default)
```bash
janus eval <absolute-path-to-markdown> --format json
```
Returns JSON with `decision_status` (recommend | conditional | blocked), `best_path`, `rejected_paths`, `critical_unknowns`, and `next_actions`.

### Binary gate check (for commit/approve moments)
```bash
janus gate <absolute-path-to-markdown>
echo "exit: $?"
```
Exit codes: 0 = pass, 1 = conditional, 2 = blocked, 3 = error.

### Compare two options
```bash
janus compare <option-a.md> <option-b.md> --format json
```

### Autonomous refinement loop (for drafts)
```bash
janus loop <file.md> --max-iterations 3 --format json
```

### Variance sampling (for borderline decisions — v0.2.0+)
```bash
janus eval <file.md> --samples 3 --format json
```
Runs eval 3 times, returns consensus verdict with a `variance_report` field exposing per-sample decision_status trace, best-path agreement %, and unioned rejected_paths / critical_unknowns with appearance frequencies. Use when a single-shot eval feels borderline or when the unknown surface matters more than the verdict. Runtime scales linearly (~N × baseline eval time).

## What to do with the output

1. **Parse `decision_status`**:
   - `recommend` with `best_path.robustness_score ∈ {medium, high}` → safe to proceed; surface best_path rationale and next_actions to the user
   - `conditional` → surface best_path AND critical_unknowns; ask the user whether to resolve unknowns before proceeding
   - `blocked` → STOP. Surface `critical_unknowns[].question_for_human` to the user. Do not proceed without answers.

2. **Surface `rejected_paths` to the user** when they are making a decision. Each rejected path has a `violated_principle` (P1-P7) and a `rejection_reason` explaining what would go wrong.

3. **Do not silently override Janus**. If Janus says `blocked`, the user must decide whether to relax a constraint or resolve the unknown. Do not proceed as if the evaluation said `recommend`.

## The Seven Janus Principles

Janus rejections will cite one of these:

- **P1 No Certainty Without Evidence** — claiming confidence beyond the stated evidence
- **P2 Unknowns Are First-Class** — silently filling missing information
- **P3 Robustness Over Optimism** — picking high-upside over high-survivability paths
- **P4 Conflict Is Rejection** — depending on mutually contradictory constraints
- **P5 Scope Discipline** — stepping outside what the document actually says
- **P6 Reversibility Preference** — committing irreversibly under uncertainty
- **P7 Abstention Is Correct** — recommending when evidence is insufficient

When surfacing Janus output, always name the principle alongside the rejection.

## Calibration note

Janus uses an LLM backend and has observed output variance on borderline cases. For decisions where Janus produced `conditional` on first run, consider running `janus eval` a second time and taking the more conservative result. This is documented in Janus's own NFRs.

## What Janus is NOT

- Not a code reviewer (use your existing code review tools for that)
- Not a deterministic validator (use JSON schema validators for strict format checks)
- Not a substitute for human approval on consequential decisions — it narrows choices and surfaces risk, it does not replace judgment

## Installation check

Before first use, verify the Janus binary is available:
```bash
command -v janus && janus --help | head -3
```

If `janus` is not found, tell the user Janus is not installed in their PATH and offer to help install it from their local repo (e.g., `npm link` from the janus repo directory).
