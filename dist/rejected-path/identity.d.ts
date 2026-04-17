import type { JanusOutput, RejectedPath } from "../types.js";
export declare function deriveCanonicalKey(path: RejectedPath): string;
export declare function normalizeRejectedPath(path: RejectedPath): RejectedPath;
export declare function normalizeOutputRejectedPaths(output: JanusOutput): JanusOutput;
