# Janus Loop — Harness-Aware Refinement Upgrade

## Context

The current `janus loop` command re-evaluates the same document multiple times and tracks convergence via `rejected_path_count` and `critical_unknown_count`. It does not modify the document between iterations and does not invoke the doom gate. Convergence is measured by whether eval metrics stabilize, not by whether the document has been hardened against adversarial failure modes.

This means `janus loop` and `janus harness` exist as parallel, non-composing tools:
- `janus loop` = repeated eval on a static document (convergence by metric stability)
- `janus harness` = single 3-pass eval+doom+crosscheck on a static document (convergence never — no refinement)

When a harness run returns BLOCKED or CONDITIONAL, the operator must manually read the output, revise the document, and re-run. This manual loop is what the original `janus loop` was designed to automate — but loop was built before harness existed.

The gap: neither tool closes the full dogfood cycle. `janus loop` lacks adversarial pressure (no doom). `janus harness` lacks iteration (no refinement). A complete decision gate should be able to run harness, synthesize findings into document improvements, and re-run until the document is robust enough to pass or until max iterations.

## Goal

Upgrade `janus loop` to support a harness-aware refinement mode that:
1. Runs the full 3-pass harness (eval → targeted doom → crosscheck)
2. When the harness verdict is BLOCKED or CONDITIONAL, extracts fatal conditions and uncovered conditions
3. Sends the document + harness findings to an LLM refiner to produce an improved document
4. Re-runs harness on the improved document
5. Terminates when harness_verdict is RECOMMEND, or when max_iterations is reached, or when non-convergence is detected

The upgraded loop replaces the need to manually iterate on spec documents. `janus harness` remains available as a single-shot tool. `janus loop --harness` activates the refinement mode.

## Constraints

- Backward compatible: `janus loop <file>` without `--harness` must behave identically to today. An automated test must assert that the eval-only loop termination reasons, iteration counts, and exit codes are unchanged after the extraction refactor. The test must fixture the plateau window: a mock backend emitting 3 identical stagnant outputs must produce `termination_reason === "non_convergence"` AND `final_iteration === 3`. The assertion must be on both the exact termination_reason string and the exact iteration number — not just the exit code. This fixture runs before and after the convergence extraction to catch off-by-one drift. The iteration counter must be incremented at the call site (runLoop or runHarnessLoop) before passing the metric history to the convergence.ts pure function — the pure function must not increment any counter internally.
- The refiner must operate in patch mode: the refiner prompt must include only the failing conditions (fatal_conditions list + uncovered enabling_conditions list), not the full crosscheck matrix. The refiner must return only a revised version of the sections that address those conditions, not a full document rewrite. The harness-loop merges the patch back onto the original document structure.
- Refinement must be bounded: max 5 iterations (same as current loop cap).
- The original document must never be overwritten. Refined documents are in-memory only unless the operator explicitly passes `--output <file>`.
- Convergence must use harness_verdict, not just eval decision_status. A document that eval rates RECOMMEND but harness rates CONDITIONAL is still not converged.
- Non-convergence fires when three consecutive iterations produce no reduction in the convergence metric (fatal_conditions.length + unattacked_conditions.length). "No reduction" means the metric is equal to or greater than the prior iteration — not strictly increasing. Plateau triggers non_convergence just as degradation does.
- Oscillation policy: track the best-scoring iteration (lowest fatal_conditions.length * 2 + unattacked_conditions.length). Ties are broken by earlier iteration (lower index wins — `if (score < bestScore || (score === bestScore && iter < bestIter))`). If the loop terminates via non_convergence or max_iteration, emit the best-scoring iteration's document under `--output`, not the final iteration's document. On termination via success or acceptable, emit the final iteration's document. If no iteration produced a valid harness_verdict (all were Infinity due to errors), emit the original input document with a warning.
- File safety: the harness-loop engine must never call `writeFile` or any file-write API with the input `filePath`. Writes are only permitted to the path supplied via `--output`. If `--output` is not supplied, no file is ever written. The safety check algorithm is: (a) resolve input: `const resolvedInput = await fs.realpath(inputPath)`, (b) resolve output: try `await fs.realpath(outputPath)`; on ENOENT, try `await fs.realpath(path.dirname(outputPath))` then append `path.basename(outputPath)`; if the dirname realpath also throws ENOENT (nested non-existent or symlinked parent path), the write is refused and an error is returned — no write proceeds when the safety check cannot be completed, (c) if `resolvedInput === resolvedOutput`, refuse the write with an error. This handles symlinked targets, non-existent output files, and nested symlinked parent directories.
- Each iteration's harness summary (iteration N, fatal=X, uncovered=Y, verdict=Z) must be emitted to stderr as a single structured line per iteration, not a full harness report dump, to avoid interleaving with backend output.

## NFRs

- Each refinement iteration costs 3 backend calls (Pass 1 eval + Pass 2 targeted doom + Pass 3 crosscheck is deterministic) plus 1 refiner call = 4 calls per iteration, max 5 iterations = 20 calls worst-case.
- `HarnessVerdict.delta_from_eval` is already a first-class field in the existing `HarnessReport` type (`src/types.ts`). The harness-loop consumes it directly — no reconstruction required. The convergence logic receives the full `HarnessReport` struct. The refiner receives only `HarnessVerdict.fatal_conditions` and `HarnessVerdict.unattacked_conditions` as extracted lists — never the full struct.
- Convergence signal: only `harness_verdict.final_recommendation` and the convergence metric (fatal_conditions.length + unattacked_conditions.length) from `HarnessReport.harness_verdict` are used to drive termination. The implementation must use an explicit null guard: `if (!report.harness_verdict) { metric = Infinity; carryForward(); continue; }` — not a null-coalescing expression (`??`), optional chaining (`?.`), or ternary that reads `eval_verdict`. The variable `eval_verdict.decision_status` must not appear anywhere in the harness-loop convergence code path. Code review must verify this is true.
- Per-iteration stderr line must be written with `process.stderr.write()` as a single atomic string ending in `\n`, not via `console.error()`. The line must not contain embedded newlines from any field values (fatal_conditions or unattacked_conditions are counts, not text — text is never interpolated into the structured line). Format: `[harness-loop] iter=N fatal=X uncovered=Y verdict=Z\n`.
- The refiner prompt must include: the full current document (read-only reference), the fatal_conditions list and unattacked_conditions list from harness_verdict only — not the full crosscheck matrix, not delta_from_eval, not covered conditions. The instruction must specify patch mode: harden only the listed failing conditions, return only revised section text, no scope expansion.
- Refiner output must be a valid markdown document. If the refiner returns non-markdown or empty output, the iteration is skipped and the previous document is carried forward.
- Non-convergence detection uses: `(fatal_conditions.length + unattacked_conditions.length)` as the convergence metric. No reduction (equal or greater) over 3 consecutive iterations = non_convergence. This matches the Constraints definition — plateau and degradation both trigger non_convergence.
- Termination reasons: `success` (harness RECOMMEND), `acceptable` (harness CONDITIONAL, stagnant ≥ 2), `blocked` (harness BLOCKED and not improving), `non_convergence`, `max_iteration`, `error`.

## Options

### Option A — `janus loop --harness` flag on existing command

Add `--harness` flag to the existing `janus loop` command. When set, uses `runHarness` instead of `buildEvalRequest` + eval, and adds a refiner pass between iterations.

Pros: Single command surface, backward compatible, reuses existing loop termination logic.
Cons: `runLoop` function signature and convergence logic would need significant changes. Risk of breaking the existing eval-loop path.

### Option B — New `src/loop/harness-loop.ts` with shared termination logic

Extract termination logic into `src/loop/convergence.ts`. Implement `runHarnessLoop` in `src/loop/harness-loop.ts`. Wire both to `janus loop` via the `--harness` flag.

Pros: Clean separation of concerns. Existing `runLoop` is untouched. Shared convergence logic prevents duplication.
Cons: Two loop engines to maintain. Convergence logic extraction requires refactoring `runLoop`.

### Option C — Replace `janus loop` with harness-loop; deprecate eval-only mode

Make harness the default loop mode. Retain eval-only as `janus loop --eval-only` for lightweight/fast use.

Pros: Simplifies the command surface long-term. Harness is strictly more informative than eval-alone.
Cons: Breaking change for `janus loop` users. Eval-only loop is 4x cheaper (1 call vs 4). Deprecating a working feature adds churn.

## Refiner Prompt Design

The refiner receives in strict patch mode:
- The current document verbatim (read-only reference — not the rewrite target)
- Only the failing conditions: the fatal_conditions list and the unattacked_conditions list from harness_verdict
- The instruction: "The following conditions in this document are either fatally attacked or not yet addressed. Revise only the sections that directly correspond to these conditions. Return only the revised section text — not the full document. Do not add new options, goals, requirements, or facts not already present in the document."

The refiner must NOT receive the full crosscheck matrix (which includes covered conditions). Passing covered conditions risks scope expansion into non-failing areas.

The harness-loop merge applies the returned patch text back onto the in-memory document. If the refiner returns output that is blank, whitespace-only, less than 50 characters, or that does not contain at least one markdown heading (`#`), the patch is rejected and the previous in-memory document is carried forward without modification.

## Assumptions

- LLM refiners can meaningfully improve a spec document when given specific fatal_conditions and uncovered_conditions from a harness run.
- 3-5 iterations is sufficient to converge most spec documents from BLOCKED to CONDITIONAL or RECOMMEND.
- Operators accept the cost of 4 backend calls per iteration for the benefit of automated convergence.
- Non-convergence is detectable within 3 iterations of no improvement.
- The refiner does not introduce hallucinated requirements when given a concrete harness verdict as the improvement target.

## Unknowns

- Whether the refiner reliably targets only the failing conditions or tends to rewrite the entire document (drift risk).
- Whether 3 iterations is sufficient for real-world blocked specs, or whether 5 is needed in practice.
- Whether the convergence metric (fatal + uncovered count) is the right signal, or whether harness_verdict.final_recommendation alone is sufficient.
- What happens when the refiner improves some conditions but worsens others (partial progress): does the loop converge or oscillate?
- Whether the refiner needs to see previous iteration history to avoid repeating the same failed improvements.

## Decision requested

Which option best balances backward compatibility, implementation safety, and convergence quality for the harness-aware loop upgrade? What conditions must hold for the refiner to produce reliable improvements without scope drift, and how should oscillation (improving some conditions, worsening others) be handled?
