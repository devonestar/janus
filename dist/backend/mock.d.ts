import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export declare class MockBackend implements JanusBackend {
    readonly name = "mock";
    constructor(_config: BackendConfig);
    isAvailable(): Promise<boolean>;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
}
