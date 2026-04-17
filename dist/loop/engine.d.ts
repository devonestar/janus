import type { JanusBackend } from "../backend/interface.js";
import type { JanusOutput, LoopState, DecisionStatus } from "../types.js";
export type LoopTerminationReason = "success" | "acceptable" | "blocked" | "non_convergence" | "max_iteration" | "error";
export interface LoopResult {
    iterations: LoopState[];
    final_iteration: number;
    termination_reason: LoopTerminationReason;
    final_evaluation: JanusOutput | null;
    convergence_history: Array<{
        iteration: number;
        rejected_path_count: number;
        critical_unknown_count: number;
        decision_status: DecisionStatus | null;
        convergence_trend: "improving" | "stagnant" | "degrading" | null;
    }>;
    error: string | null;
}
export interface LoopOptions {
    maxIterations: number;
    backend: JanusBackend;
    compact: boolean;
}
export declare function runLoop(filePath: string, options: LoopOptions): Promise<LoopResult>;
