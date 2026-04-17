import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";
import { ClaudeBackend } from "./claude.js";
import { CodexBackend } from "./codex.js";
import { OpenCodeBackend } from "./opencode.js";
import { OpenAIAPIBackend } from "./openai-api.js";
import { AnthropicAPIBackend } from "./anthropic-api.js";
import { MockBackend } from "./mock.js";

export interface JanusBackend {
  readonly name: string;
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
  isAvailable(): Promise<boolean>;
}

export function createBackend(config: BackendConfig): JanusBackend {
  switch (config.type) {
    case "claude":
      return new ClaudeBackend(config);
    case "codex":
      return new CodexBackend(config);
    case "opencode":
      return new OpenCodeBackend(config);
    case "openai-api":
      return new OpenAIAPIBackend(config);
    case "anthropic-api":
      return new AnthropicAPIBackend(config);
    case "mock":
      return new MockBackend(config);
    default:
      throw new Error(`Unknown backend type: ${config.type}`);
  }
}
