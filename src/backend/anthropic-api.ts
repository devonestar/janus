import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";

export class AnthropicAPIBackend implements JanusBackend {
  readonly name = "anthropic-api";
  private model: string;
  private timeout: number;

  constructor(config: BackendConfig) {
    this.model = config.model ?? "claude-sonnet-4-20250514";
    this.timeout = config.timeout ?? 120_000;
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env["ANTHROPIC_API_KEY"];
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      return { raw: "", parsed: null, error: "ANTHROPIC_API_KEY environment variable not set" };
    }

    const body = {
      model: this.model,
      max_tokens: 8192,
      system: request.systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            "## Document to Evaluate\n",
            request.document,
            "\n---\n",
            "## Required Output Format\n",
            request.outputSchema,
            "\n\nRespond with ONLY a valid JSON object matching the schema above. No markdown fences, no explanation outside the JSON.",
          ].join("\n"),
        },
      ],
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        return { raw: text, parsed: null, error: `Anthropic API ${response.status}: ${text}` };
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      const raw = data.content?.[0]?.text ?? "";

      return this.parseResponse(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { raw: "", parsed: null, error: `Anthropic API error: ${message}` };
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
