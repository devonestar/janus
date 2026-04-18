import type { JanusBackend } from "../backend/interface.js";
import type { HarnessReport } from "../types.js";
export interface HarnessOptions {
    backend: JanusBackend;
    compact?: boolean;
}
export declare function runHarness(file: string, opts: HarnessOptions): Promise<HarnessReport>;
export declare function formatHarnessOutput(report: HarnessReport, format: "json" | "markdown"): string;
