import { readFile } from "node:fs/promises";
import { buildEvalRequest } from "../prompt/builder.js";
import { normalizeOutputRejectedPaths } from "../rejected-path/identity.js";
import { suppressCandidatePaths } from "../candidate-path/identity.js";
export async function runLoop(filePath, options) {
    const states = [];
    const maxIter = Math.min(Math.max(options.maxIterations, 1), 5);
    let currentDoc = await readFile(filePath, "utf-8");
    let prevRejected = null;
    let prevUnknowns = null;
    let stagnantStreak = 0;
    let noImprovementStreak = 0;
    for (let iter = 1; iter <= maxIter; iter++) {
        const request = {
            document: currentDoc,
            systemPrompt: (await buildEvalRequest(filePath, options.compact)).systemPrompt,
            outputSchema: (await buildEvalRequest(filePath, options.compact)).outputSchema,
        };
        const response = await options.backend.evaluate(request);
        if (!response.parsed) {
            return {
                iterations: states,
                final_iteration: iter,
                termination_reason: "error",
                final_evaluation: null,
                convergence_history: states.map(stateToHistory),
                error: response.error ?? "Backend returned no parsed output",
            };
        }
        const evaluation = suppressCandidatePaths(normalizeOutputRejectedPaths(response.parsed));
        const rejectedCount = evaluation.rejected_paths.length;
        const unknownCount = evaluation.critical_unknowns.length;
        let trend = null;
        if (prevRejected !== null && prevUnknowns !== null) {
            const rejDelta = rejectedCount - prevRejected;
            const unkDelta = unknownCount - prevUnknowns;
            if (rejDelta < 0 || unkDelta < 0) {
                trend = "improving";
                stagnantStreak = 0;
                noImprovementStreak = 0;
            }
            else if (rejDelta === 0 && unkDelta === 0) {
                trend = "stagnant";
                stagnantStreak++;
                noImprovementStreak++;
            }
            else {
                trend = "degrading";
                stagnantStreak = 0;
                noImprovementStreak++;
            }
        }
        const state = {
            iteration: iter,
            document: currentDoc,
            evaluation,
            rejected_path_count: rejectedCount,
            critical_unknown_count: unknownCount,
            decision_status: evaluation.decision_status,
            convergence_trend: trend,
        };
        states.push(state);
        if (evaluation.decision_status === "blocked") {
            return {
                iterations: states,
                final_iteration: iter,
                termination_reason: "blocked",
                final_evaluation: evaluation,
                convergence_history: states.map(stateToHistory),
                error: null,
            };
        }
        if (evaluation.decision_status === "recommend" &&
            evaluation.best_path &&
            (evaluation.best_path.robustness_score === "medium" ||
                evaluation.best_path.robustness_score === "high")) {
            return {
                iterations: states,
                final_iteration: iter,
                termination_reason: "success",
                final_evaluation: evaluation,
                convergence_history: states.map(stateToHistory),
                error: null,
            };
        }
        if (evaluation.decision_status === "conditional" &&
            evaluation.best_path !== null &&
            stagnantStreak >= 2) {
            return {
                iterations: states,
                final_iteration: iter,
                termination_reason: "acceptable",
                final_evaluation: evaluation,
                convergence_history: states.map(stateToHistory),
                error: null,
            };
        }
        if (noImprovementStreak >= 3) {
            return {
                iterations: states,
                final_iteration: iter,
                termination_reason: "non_convergence",
                final_evaluation: evaluation,
                convergence_history: states.map(stateToHistory),
                error: null,
            };
        }
        prevRejected = rejectedCount;
        prevUnknowns = unknownCount;
    }
    const finalState = states[states.length - 1];
    return {
        iterations: states,
        final_iteration: finalState?.iteration ?? 0,
        termination_reason: "max_iteration",
        final_evaluation: finalState?.evaluation ?? null,
        convergence_history: states.map(stateToHistory),
        error: null,
    };
}
function stateToHistory(s) {
    return {
        iteration: s.iteration,
        rejected_path_count: s.rejected_path_count,
        critical_unknown_count: s.critical_unknown_count,
        decision_status: s.decision_status,
        convergence_trend: s.convergence_trend,
    };
}
