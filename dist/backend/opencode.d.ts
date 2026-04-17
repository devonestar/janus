import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export declare class OpenCodeBackend implements JanusBackend {
    readonly name = "opencode";
    private timeout;
    constructor(config: BackendConfig);
    isAvailable(): Promise<boolean>;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
    private parseResponse;
}
