import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";

export class OpenAIAPIBackend implements JanusBackend {
  readonly name = "openai-api";
  private model: string;
  private timeout: number;

  constructor(config: BackendConfig) {
    this.model = config.model ?? "gpt-4o";
    this.timeout = config.timeout ?? 120_000;
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env["OPENAI_API_KEY"];
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      return { raw: "", parsed: null, error: "OPENAI_API_KEY environment variable not set" };
    }

    const body = {
      model: this.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        {
          role: "user",
          content: [
            "## Document to Evaluate\n",
            request.document,
            "\n---\n",
            "## Required Output Format\n",
            request.outputSchema,
            "\n\nRespond with ONLY a valid JSON object matching the schema above.",
          ].join("\n"),
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        return { raw: text, parsed: null, error: `OpenAI API ${response.status}: ${text}` };
      }

      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
      const raw = data.choices[0]?.message?.content ?? "";

      return this.parseResponse(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { raw: "", parsed: null, error: `OpenAI API error: ${message}` };
    }
  }

  private parseResponse(raw: string): EvaluationResponse {
    try {
      const parsed = JSON.parse(raw);
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
