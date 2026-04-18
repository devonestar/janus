import type { EvaluationRequest } from "../types.js";
export declare function buildEvalRequest(filePath: string, compact?: boolean, includeCandidatePaths?: boolean): Promise<EvaluationRequest>;
export declare function buildCompareRequest(fileA: string, fileB: string): Promise<EvaluationRequest>;
export declare function buildDoomRequest(input: string, compact?: boolean): Promise<EvaluationRequest>;
