import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";

const execFileAsync = promisify(execFile);

export class OpenCodeBackend implements JanusBackend {
  readonly name = "opencode";
  private timeout: number;

  constructor(config: BackendConfig) {
    this.timeout = config.timeout ?? 120_000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync("which", ["opencode"]);
      return true;
    } catch {
      return false;
    }
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    const fullPrompt = [
      request.systemPrompt,
      "\n---\n",
      "## Document to Evaluate\n",
      request.document,
      "\n---\n",
      "## Required Output Format\n",
      request.outputSchema,
      "\n\nRespond with ONLY a valid JSON object matching the schema above.",
    ].join("\n");

    try {
      const { stdout } = await execFileAsync(
        "opencode",
        ["--non-interactive", "-p", fullPrompt],
        { timeout: this.timeout, maxBuffer: 1024 * 1024 }
      );

      return this.parseResponse(stdout);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { raw: "", parsed: null, error: `OpenCode backend error: ${message}` };
    }
  }

  private parseResponse(raw: string): EvaluationResponse {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { raw, parsed: null, error: "No JSON object found in response" };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.decision_status) {
        return { raw, parsed: null, error: "Response missing decision_status field" };
      }
      return { raw, parsed, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { raw, parsed: null, error: `JSON parse error: ${message}` };
    }
  }
}
