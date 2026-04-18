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
export declare function checkConvergence(history: ConvergenceMetric[], maxIterations: number, stagnantThreshold?: number, nonConvergenceWindow?: number): ConvergenceResult;
