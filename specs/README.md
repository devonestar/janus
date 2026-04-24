# specs/

Internal design specs, dogfood documents, and roadmap contracts for Janus development.

These documents record design decisions, experiments, and self-evaluation results from Janus's dogfood process. They are not user-facing documentation — see the root `README.md` for the product guide.

## Contents

| File | Topic |
|------|-------|
| `janus-canonical-rejected-path-key.md` | Canonical aggregation key design for rejected paths |
| `janus-canonical-key-schema-extension.md` | Schema extension options for canonical identity |
| `janus-dogfood-canonical-identity.md` | Dogfood results: stable rejected-path identity |
| `janus-candidate-path-quality-contract.md` | Quality contract for `candidate_paths` |
| `janus-explicit-alternatives-contract.md` | Contract for bounded explicit alternatives |
| `janus-dogfood-explicit-alternatives.md` | Dogfood results: explicit alternative generation |
| `janus-first-increment-alternatives.md` | First increment roadmap: canonicalization + alternatives |
| `janus-failure-future-narratives.md` | Proposed `failure_chain` field for rejected paths |
| `janus-honest-futures.md` | Internal bar for honest futures-facing language |
| `janus-persona-pr-merge-gate.md` | Persona-gated PR/merge workflow proposal |
| `janus-doom-gate.md` | Doom Gate: adversarial pre-mortem command proposal |
| `janus-doctor-probe.md` | Doctor --probe + exit codes + JSON output (Round 14 dogfood) |
| `janus-adversarial-decision-harness.md` | Product direction: model-agnostic adversarial decision harness |
| `janus-lens-contract.md` | Fixed-lens system contract: scope, grounding, and overlap rules for 6 evaluation lenses |
| `janus-deterministic-collapse.md` | Deterministic collapse rules: 7-metric floor gates with fatal dominance |
