# Janus Failure Future Narratives

## Context

Janus currently rejects paths with a one-line `rejection_reason` and a `violated_principle` code. This tells the operator *that* a path was rejected and *which principle* it violated, but not *how* the failure would unfold if that path were chosen.

Example of current output:
```
rejected_paths:
  - name: Option C — Full scenario engine
    rejection_reason: "Depends on multiple unvalidated assumptions and irreversible early decisions"
    violated_principle: P6
```

This is a verdict, not a story. The operator knows the path lost but cannot see the chain of events that leads to failure. Without the failure narrative, the operator must either trust Janus blindly or reconstruct the reasoning themselves.

Janus's branding says "from many possible futures, keep the robust path." If the tool shows only the winning future and labels the losing futures with one-line tags, it is not actually showing futures — it is showing a scoreboard.

The honest-futures bar (janus-honest-futures.md) requires that "failure modes remain first-class" and that "futures framing must never imply prophecy or certainty." A structured failure narrative for each rejected path would make failure modes genuinely first-class rather than merely tagged.

## Goal

Extend Janus's rejected-path output so each rejection includes a structured failure narrative: a short causal chain showing how choosing that path leads to a degraded or failed outcome under the document's stated constraints and unknowns.

## Constraints

- The failure narrative must be grounded in the document's own content — not invented scenarios.
- The narrative must remain conditional ("if X, then Y could...") per P1.
- The extension must be additive to the existing `rejected_paths` schema.
- The narrative must be short enough to scan (not a multi-page essay per rejection).
- The change must not break existing consumers that ignore unknown fields.
- The narrative must add genuine explanatory value beyond what `rejection_reason` already provides.

## NFRs

- Each failure narrative should be 2-5 steps showing a causal chain, not a single restated conclusion.
- The narrative should reference specific document elements (constraints, NFRs, unknowns) that drive the failure.
- The output should remain machine-parseable (structured field, not freeform prose embedded in rejection_reason).
- Runtime cost increase per eval should stay within 1.5x of current baseline.

## Options

### Option A — Add `failure_chain` field to rejected_paths

Extend each rejected path with a structured field:
```json
{
  "failure_chain": [
    { "step": 1, "event": "Team commits to irreversible architecture change", "trigger": "C-2: no rollback path specified" },
    { "step": 2, "event": "Unknown U-1 resolves adversely", "trigger": "U-1: vendor API stability unvalidated" },
    { "step": 3, "event": "Recovery requires full rewrite", "trigger": "violates P6: reversibility preference" }
  ]
}
```

Each step is a concrete event grounded in document references. The chain makes the failure path visible as a story, not just a tag.

### Option B — Expand rejection_reason to multi-sentence narrative

Keep the existing field but instruct the prompt to produce 2-4 sentences instead of one, describing the causal chain in prose.

### Option C — Add a separate `failure_scenarios` top-level field

Create a new top-level output section that maps each rejected path to one or more failure scenarios, independent of the rejected_paths array.

### Option D — No change; current rejection_reason is sufficient

Keep the status quo. Operators can infer the failure story from the principle code and reason text.

## Assumptions

- Operators find one-line rejection reasons insufficient for understanding *why* a path fails.
- LLM backends can produce grounded causal chains from document content without excessive hallucination.
- A 2-5 step failure chain adds enough explanatory value to justify the schema extension and prompt complexity.
- The honest-futures bar is a real product goal, not just an internal aspiration document.

## Unknowns

- Whether LLM backends can reliably ground failure chain steps in specific document elements rather than generating generic failure stories.
- Whether the added prompt complexity for failure narratives degrades the quality of other output fields (best_path, critical_unknowns).
- Whether 2-5 steps is the right granularity, or whether most failures are adequately explained in 1-2 steps.
- What the actual runtime cost increase will be per eval when generating structured failure chains.
- Whether operators/reviewers will actually read and use failure narratives, or whether they add noise.

## Decision requested

Which option is the most robust path for making Janus's failure futures visible and honest, and what conditions should bound that implementation?
