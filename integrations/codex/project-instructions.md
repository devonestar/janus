# Codex Project Instructions for Janus

Codex CLI does not support MCP in this integration (per operator constraint) and has no native skill convention. Use this snippet in your Codex project instructions or `codex exec` prompt prefix so the agent invokes Janus at the right moments.

## Copy-paste snippet

Add to your project's `AGENTS.md`, `CODEX.md`, or similar project-instructions file that Codex reads:

```markdown
## Janus Pre-Decision Gate

When you are about to finalize or commit any of the following:
- A PRD, spec, or design document
- An ADR or technical decision
- A plan or roadmap
- A comparison between two or more options

You MUST run Janus before proceeding.

### Invocation
Use the Bash tool to run:

    janus gate <absolute-path-to-file.md>

Check the exit code:
- 0: gate PASSED → safe to continue
- 1: conditional → surface rejected_paths and critical_unknowns to the user, then ask
- 2: blocked → STOP. Ask the user the question_for_human items
- 3: error → report the error; do not silently proceed

For richer context, use:

    janus eval <file.md> --format json

Parse the JSON for decision_status, best_path, rejected_paths[].violated_principle (P1-P7), and critical_unknowns[].description.

### What to surface to the user

- `best_path.name` and `best_path.rationale`
- Every `rejected_paths[].name` with its `violated_principle` and `rejection_reason`
- Every `critical_unknowns[].description` with `impact`

Do not hide rejections or unknowns from the user. Do not override a `blocked` outcome without explicit user approval.

### Do NOT invoke Janus for

- Routine code edits that do not change stated requirements
- Conversational clarifications
- Documents in freeform brainstorming state
```
