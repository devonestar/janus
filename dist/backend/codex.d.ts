import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export declare class CodexBackend implements JanusBackend {
    readonly name = "codex";
    private model;
    private timeout;
    constructor(config: BackendConfig);
    isAvailable(): Promise<boolean>;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
    private spawnWithStdin;
    private parseResponse;
}
