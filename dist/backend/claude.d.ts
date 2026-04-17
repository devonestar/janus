import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export declare class ClaudeBackend implements JanusBackend {
    readonly name = "claude";
    private model;
    private timeout;
    constructor(config: BackendConfig);
    isAvailable(): Promise<boolean>;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
    private spawnWithStdin;
    private parseResponse;
}
