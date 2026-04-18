import type { LoopTerminationReason } from "./engine.js";

export interface ConvergenceMetric {
  iteration: number;
  score: number;
  termination_reason_override?: LoopTerminationReason;
}

export interface ConvergenceResult {
  terminate: boolean;
  reason: LoopTerminationReason | null;
  best_iteration_index: number;
}

export function checkConvergence(
  history: ConvergenceMetric[],
  maxIterations: number,
  stagnantThreshold = 2,
  nonConvergenceWindow = 3,
): ConvergenceResult {
  const n = history.length;
  if (n === 0) return { terminate: false, reason: null, best_iteration_index: 0 };

  const current = history[n - 1];

  if (current.termination_reason_override) {
    return {
      terminate: true,
      reason: current.termination_reason_override,
      best_iteration_index: bestIndex(history),
    };
  }

  if (current.score === 0) {
    return { terminate: true, reason: "success", best_iteration_index: n - 1 };
  }

  if (n >= nonConvergenceWindow) {
    const window = history.slice(n - nonConvergenceWindow);
    const noReduction = window.every(
      (m, i) => i === 0 || m.score >= window[i - 1].score,
    );
    if (noReduction) {
      return {
        terminate: true,
        reason: "non_convergence",
        best_iteration_index: bestIndex(history),
      };
    }
  }

  if (n >= stagnantThreshold) {
    const window = history.slice(n - stagnantThreshold);
    const stagnant = window.every((m, i) => i === 0 || m.score === window[0].score);
    if (stagnant && current.score > 0) {
      return {
        terminate: true,
        reason: "acceptable",
        best_iteration_index: bestIndex(history),
      };
    }
  }

  if (n >= maxIterations) {
    return {
      terminate: true,
      reason: "max_iteration",
      best_iteration_index: bestIndex(history),
    };
  }

  return { terminate: false, reason: null, best_iteration_index: bestIndex(history) };
}

function bestIndex(history: ConvergenceMetric[]): number {
  let best = 0;
  for (let i = 1; i < history.length; i++) {
    const s = history[i].score;
    const b = history[best].score;
    if (s < b || (s === b && history[i].iteration < history[best].iteration)) {
      best = i;
    }
  }
  return best;
}
