import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export declare class OpenAIAPIBackend implements JanusBackend {
    readonly name = "openai-api";
    private model;
    private timeout;
    constructor(config: BackendConfig);
    isAvailable(): Promise<boolean>;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
    private parseResponse;
}
