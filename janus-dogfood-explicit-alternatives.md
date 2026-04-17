# Janus Dogfood — Explicit Alternative Generation / Path Decomposition

## Context

Janus has already taken the first structural step toward an honest "many futures" story:
- rejected paths now carry additive canonical identity fields
- sampling aggregation can group semantically identical rejected paths more stably than before

The next roadmap step is to make alternatives explicit.

Current harness truth:
- Janus is a CLI-first decision gate
- it evaluates one document and returns a best path, rejected paths, and critical unknowns
- it can compare two inputs and sample repeated evaluations
- it still relies heavily on whatever options the input document already names

Current gap:
- when the document names only one path or underspecifies alternatives, Janus does not yet structurally surface a bounded candidate-path set
- this keeps "many futures" as mostly metaphor rather than inspectable output structure

## Goal

Decide the most robust next increment for making alternatives explicit while preserving Janus's CLI-first, principle-driven gate behavior.

## Constraints

- The increment must preserve Janus as a CLI-first decision gate.
- The change must remain compatible with P1–P7, especially abstention, scope discipline, and robustness over optimism.
- The increment must be bounded and inspectable rather than open-ended creative generation.
- The step must deliver standalone value even if later roadmap items do not ship.

## NFRs

- Alternative handling should become more structurally visible than it is today.
- The new output should help reviewers/operators reason about candidate paths instead of adding decorative text.
- The implementation should be small enough to validate with fixtures and existing CLI workflows before broader expansion.

## Options

### Option A — Keep alternatives implicit

Do not add new structure. Continue relying on the document's named options plus Janus's existing best-path/rejected-path outputs.

### Option B — Add bounded explicit alternatives/path decomposition

Extend Janus so that when documents underspecify the choice set, it can surface a small, inspectable set of candidate paths or decomposed alternatives before selecting the most robust one.

### Option C — Jump directly to a larger scenario engine

Introduce a more expansive future-space or scenario subsystem now.

## Assumptions

- There is real operator value in seeing candidate paths explicitly when the source document is thin.
- Bounded alternative generation can be done without violating scope discipline if it is clearly marked and constrained.
- Canonical rejected-path identity is a sufficient first foundation for this next step.

## Unknowns

- Where explicit alternatives should live in the output contract.
- How to keep alternative generation bounded enough to avoid theatrical complexity.
- What minimum document structure should be required before alternatives are surfaced rather than suppressed.

## Decision requested

Which option is the most robust next roadmap step for Janus, and what concrete constraints should govern it so the future remains honest?
