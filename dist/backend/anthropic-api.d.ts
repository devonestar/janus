import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export declare class AnthropicAPIBackend implements JanusBackend {
    readonly name = "anthropic-api";
    private model;
    private timeout;
    constructor(config: BackendConfig);
    isAvailable(): Promise<boolean>;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
    private parseResponse;
}
