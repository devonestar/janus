import type { JanusBackend } from "../backend/interface.js";
import type { LoopTerminationReason } from "./engine.js";
import type { HarnessReport } from "../types.js";
export interface HarnessLoopOptions {
    backend: JanusBackend;
    compact?: boolean;
    maxIterations?: number;
    outputPath?: string;
}
export interface HarnessLoopResult {
    termination_reason: LoopTerminationReason;
    final_iteration: number;
    best_iteration: number;
    iterations: Array<{
        iteration: number;
        fatal: number;
        uncovered: number;
        verdict: string;
        score: number;
    }>;
    final_report: HarnessReport | null;
    best_report: HarnessReport | null;
    error: string | null;
}
export declare function runHarnessLoop(filePath: string, opts: HarnessLoopOptions): Promise<HarnessLoopResult>;
