import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
export interface JanusBackend {
    readonly name: string;
    evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
    isAvailable(): Promise<boolean>;
}
export declare function createBackend(config: BackendConfig): JanusBackend;
