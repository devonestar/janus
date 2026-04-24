# Janus Deterministic Collapse Rules

## Context

The parent spec `janus-adversarial-decision-harness.md` was evaluated by the harness and received a fatal finding (Fatal 2):

> "The fixed metric set must be implemented as deterministic collapse rules, not soft scores — any metric below a defined floor must degrade decision_status rather than be averaged away (enforces C-5 and NFR on collapse rules)"

This finding is correct. The parent spec names seven metrics (evidence coverage, critical unknown pressure, fatal condition count, attack coverage, reversibility, execution realism, alternative survival) but does not specify how they collapse into a gate verdict. Without explicit collapse rules, any implementation is free to average them, weight them, or ignore low-scoring dimensions — all of which violate C-5 ("hard contradictions, missing evidence, and fatal conditions must dominate soft positives; weighted-average optimism is forbidden").

The current harness verdict logic in `src/harness/engine.ts` (`computeHarnessVerdict`) uses three deterministic rules:

1. `fatal_conditions.length > 0` forces `blocked`
2. `condition_survival_rate < 0.5` forces `conditional`
3. Otherwise, pass through `evalOutput.decision_status`

The loop convergence score in `src/loop/convergence.ts` uses `fatal * 2 + uncovered` as a scalar, where `score === 0` triggers success termination.

These rules are deterministic and correct for the current two-dimensional harness (fatal vs. uncovered). They are not sufficient for the seven-metric contract the parent spec requires. The gap is architectural: the harness currently measures attack coverage and fatal severity, but has no gates for evidence coverage, critical unknown pressure, reversibility, execution realism, or alternative survival. A metric that is absent cannot degrade the verdict.

This spec defines the collapse architecture that closes that gap.

## Goal

Define deterministic collapse rules that map the seven parent-spec metrics to gate verdicts, such that:

1. Any metric below its defined floor degrades `decision_status` rather than being averaged away.
2. Fatal conditions dominate all other signals, preserving the existing harness contract.
3. Evidence gaps and unknown pressure degrade confidence before survivor comparison runs.
4. The collapse order is explicit, auditable, and model-agnostic.
5. The existing `HarnessVerdict` contract is extended, not replaced, so callers are not broken.

## Constraints

- C-1: Weighted averaging of metrics is forbidden. Each metric either passes its floor or forces a downgrade. No metric can compensate for another.
- C-2: The collapse must be deterministic given the same metric values. No LLM judgment may participate in the collapse step itself.
- C-3: The existing harness contract (`HarnessVerdict` fields: `condition_survival_rate`, `unattacked_conditions`, `fatal_conditions`, `verification_required`, `final_recommendation`, `delta_from_eval`) must remain valid. New fields may be added; existing fields must not be removed or semantically changed.
- C-4: Each metric must have a computable definition that does not require a new LLM call. Metrics are derived from existing harness pass outputs (eval, targeted doom, crosscheck matrix) or from document structure analysis.
- C-5: Hard contradictions, missing evidence, and fatal conditions must dominate soft positives. This is inherited directly from the parent spec's C-5.
- C-6: The collapse rules must be expressible as a precedence-ordered list of floor checks. If a floor check fails, the verdict is set and no lower-priority check can upgrade it.
- C-7: Single-maintainer scope. The collapse engine must be implementable as an extension to `computeHarnessVerdict` in `src/harness/engine.ts`, not a separate pipeline.

## NFRs

- Each metric must have a named floor value. Floor values are constants, not runtime parameters. Operators cannot tune them per-invocation.
- A metric that cannot be computed (missing data) must be treated as failing its floor, not as neutral. Absence of evidence is not evidence of absence.
- The collapse precedence order must be documented in code comments adjacent to the implementation, not only in this spec.
- `delta_from_eval` must include which metric triggered the downgrade, not only the direction of change. Example: `recommend→blocked (metric=fatal_condition_count, value=2, floor=0)`.
- The seven metrics must appear as named fields in the extended `HarnessVerdict` so callers can inspect individual metric values without re-deriving them.
- Collapse rules must not produce `recommend` when `information_quality` is `insufficient`. An insufficient-quality eval is treated as a failed evidence coverage check regardless of other metric values.

## Options

### Option A — Extend current harness logic with the 7-metric floor as additional deterministic gates

Keep `computeHarnessVerdict` as the single collapse function. After the existing three rules (fatal dominates, survival rate < 0.5 forces conditional, else pass through), add four additional floor checks for the metrics not yet covered: evidence coverage, critical unknown pressure, reversibility, and execution realism. Alternative survival is derived from the existing `condition_survival_rate` check and does not need a new gate.

The collapse order becomes:

1. `fatal_condition_count > 0` → `blocked` (existing, preserved)
2. `evidence_coverage < floor` → `blocked` (new: missing evidence is fatal)
3. `critical_unknown_pressure > floor` → `conditional` at minimum (new)
4. `attack_coverage < floor` (i.e., `condition_survival_rate < 0.5`) → `conditional` (existing, renamed)
5. `reversibility < floor` → downgrade one level (new)
6. `execution_realism < floor` → downgrade one level (new)
7. `alternative_survival < floor` → `conditional` at minimum (new)
8. Else: pass through `evalOutput.decision_status`

Each new metric is computed from existing pass outputs:

- `evidence_coverage`: ratio of `best_path.enabling_conditions` that have at least one explicit evidence anchor in the document (derived from document structure analysis, already available via `analyzeDocumentStructure`). Floor: `0.5`.
- `critical_unknown_pressure`: count of `critical_unknowns` with `source === "missing_field"` or `source === "information_asymmetry"`. Floor: `3` (more than 2 hard unknowns forces conditional).
- `reversibility`: binary derived from `best_path.fragility_warnings` — if any warning contains the word "irreversible" or "lock-in", reversibility fails. Floor: no irreversibility warnings on the recommended path.
- `execution_realism`: ratio of `best_path.enabling_conditions` that were attacked by doom (i.e., appear in `crosscheck_matrix` with `doom_covered === true`). Floor: `0.5`. This overlaps with attack coverage but measures the recommended path specifically, not all conditions.
- `alternative_survival`: count of `rejected_paths` where `could_recover === true`. Floor: at least one recoverable alternative must exist when `decision_status` is not `recommend`.

Pros:
- Preserves the existing harness contract (C-3). Callers see the same `HarnessVerdict` shape with additional fields.
- Additive change: the existing three rules are not removed, only extended. Regression risk is low.
- All new metrics are computable from data already present after Pass 1 and Pass 3 (C-4).
- Satisfies C-6: the collapse is a precedence-ordered list of floor checks.
- Satisfies C-7: single function extension, no new pipeline stage.

Cons:
- The floor values for `evidence_coverage` and `execution_realism` (both `0.5`) are guesses. They need empirical validation on real specs before being treated as stable.
- `reversibility` as a keyword scan on `fragility_warnings` is fragile. A model that phrases the same concern differently will not trigger the floor.
- The overlap between `execution_realism` and `attack_coverage` (both derived from doom coverage) may produce redundant downgrades on the same underlying gap.

### Option B — Replace current harness verdict logic entirely with the new 7-metric collapse engine

Remove `computeHarnessVerdict` and replace it with a new `computeCollapseVerdict` function that takes all seven metrics as explicit inputs and applies the collapse precedence order from scratch. The existing three rules are subsumed into the new engine rather than preserved as a separate layer.

The new function signature would be:

```
computeCollapseVerdict(metrics: CollapseMetrics, evalOutput: JanusOutput): HarnessVerdict
```

where `CollapseMetrics` is a new type containing all seven named metric values.

Pros:
- Cleaner architecture. The collapse logic is in one place with explicit inputs.
- Easier to test: each metric can be set independently in unit tests.
- Removes the implicit dependency on `condition_survival_rate` as a proxy for multiple concerns.

Cons:
- Breaks the existing harness contract at the implementation level, even if the output shape is preserved (violates C-3's spirit of minimal disruption).
- Requires computing all seven metrics before any collapse check runs, even when `fatal_condition_count > 0` would short-circuit immediately. This is wasteful and obscures the dominance hierarchy.
- A full replacement increases regression risk for a single-maintainer project (C-7). The existing harness logic has been validated on internal dogfood; a replacement has not.
- Does not satisfy C-6 as naturally as Option A: a function that takes all metrics simultaneously and applies rules is harder to read as a precedence-ordered list than a sequential gate chain.

### Option C — Keep current harness logic unchanged, add metrics as advisory-only output fields

Do not change `computeHarnessVerdict`. Instead, compute the seven metrics after the verdict is determined and attach them to `HarnessVerdict` as informational fields. The metrics do not affect `final_recommendation`.

Pros:
- Zero regression risk. The existing harness contract is unchanged.
- Operators can inspect metric values and draw their own conclusions.
- Satisfies C-3 and C-7 trivially.

Cons:
- Directly violates the parent spec's fatal finding. The finding is explicit: metrics must degrade `decision_status`, not appear as advisory output. Option C is the exact failure mode the finding names.
- Violates C-5: a metric below its floor that does not affect the verdict is a soft positive being averaged away by omission.
- Violates C-6: there is no collapse precedence order if metrics do not participate in the verdict.
- An advisory metric that operators must manually interpret reintroduces the model-quality dependency the parent spec is trying to eliminate. Operators will disagree on what "low execution realism" means in practice.

## Assumptions

- A-1: The seven metrics from the parent spec are computable from existing harness pass outputs without a new LLM call. Specifically: eval output provides `best_path`, `rejected_paths`, `critical_unknowns`, and `information_quality`; targeted doom provides `doom_scenarios` with severity; crosscheck matrix provides `doom_covered` per condition; document structure analysis provides evidence anchors.
- A-2: Floor values of `0.5` for ratio-based metrics (evidence coverage, execution realism, attack coverage) are conservative enough to avoid false positives on well-grounded specs while catching genuinely weak ones. This assumption requires empirical validation.
- A-3: The keyword scan for `reversibility` (checking `fragility_warnings` for "irreversible" or "lock-in") is a reasonable proxy until a structured reversibility field is added to `BestPath`. The scan will miss paraphrases but will not produce false positives.
- A-4: `critical_unknown_pressure` floor of 3 (more than 2 hard unknowns forces conditional) is calibrated against the internal dogfood corpus, where specs with 3+ `missing_field` unknowns consistently produced `conditional` or `blocked` verdicts from the LLM. The floor makes this explicit rather than model-dependent.
- A-5: Option A's additive approach does not introduce ordering conflicts with the existing three rules. The new gates are checked after the existing fatal check and before the pass-through, so the dominance hierarchy is preserved.

## Unknowns

- U-1: Whether `evidence_coverage` as a ratio of enabling conditions with explicit evidence anchors is a meaningful signal, or whether most enabling conditions in real specs are stated without inline evidence by convention. If the latter, the floor will trigger on nearly every spec and produce systematic false positives.
- U-2: Whether the `execution_realism` metric (doom coverage of the recommended path's enabling conditions) is sufficiently distinct from `attack_coverage` (doom coverage of all conditions) to justify a separate gate. If the two metrics are always correlated, one of them is redundant.
- U-3: Whether `alternative_survival` (at least one recoverable rejected path) is a meaningful gate, or whether many legitimate `blocked` verdicts have zero recoverable alternatives by design. If the latter, the floor would force `conditional` on specs that are correctly `blocked`.
- U-4: Whether the collapse precedence order in Option A produces the right verdict on the existing internal dogfood corpus. The order has not been validated against historical harness runs.
- U-5: Whether `reversibility` as a keyword scan on `fragility_warnings` is stable enough across backends, or whether different models phrase irreversibility concerns in ways that the scan misses. If the scan is unreliable, the metric should be deferred until `BestPath` has a structured `reversibility` field.

## Decision requested

Which collapse architecture gives Janus deterministic fatal-dominance while preserving the existing harness contract?

More specifically:

1. Should the collapse rules be implemented as an extension to the existing `computeHarnessVerdict` function (Option A), a full replacement (Option B), or advisory-only output (Option C)?
2. If Option A is chosen, which of the five new metric floors (evidence coverage, critical unknown pressure, reversibility, execution realism, alternative survival) should be deferred pending empirical validation, and which are safe to ship immediately?
3. What enabling conditions must hold before the floor values are treated as stable constants rather than provisional guesses?
