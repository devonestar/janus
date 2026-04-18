import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig, JanusOutput } from "../types.js";

const execFileAsync = promisify(execFile);

export class OpenCodeBackend implements JanusBackend {
  readonly name = "opencode";
  private timeout: number;

  constructor(config: BackendConfig) {
    this.timeout = config.timeout ?? 240_000;
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

    const tmpFile = join(tmpdir(), `janus-opencode-${Date.now()}.md`);
    await writeFile(tmpFile, fullPrompt, "utf-8");

    try {
      const stdout = await this.spawnCollect(
        "opencode",
        ["run", "--format", "json", "-f", tmpFile, "--", "Respond with ONLY a valid JSON object as instructed in the attached file."],
        this.timeout
      );
      const text = this.extractTextFromEvents(stdout);
      return this.parseResponse(text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { raw: "", parsed: null, error: `OpenCode backend error: ${message}` };
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  }

  private spawnCollect(cmd: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        fn();
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.includes('"step_finish"') || stdout.includes('"step-finish"')) {
          settle(() => resolve(stdout));
        }
      });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        settle(() => {
          if (stdout.trim()) resolve(stdout);
          else reject(new Error(`opencode timed out after ${timeoutMs}ms`));
        });
      }, timeoutMs);

      child.on("close", () => {
        settle(() => {
          if (stdout.trim()) resolve(stdout);
          else reject(new Error(stderr.trim() || "opencode produced no output"));
        });
      });

      child.on("error", (err) => {
        settle(() => reject(err));
      });
    });
  }

  private extractTextFromEvents(stdout: string): string {
    const lines = stdout.split("\n").filter((l) => l.trim());
    const parts: string[] = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as { type: string; part?: { text?: string } };
        if (event.type === "text" && event.part?.text) {
          parts.push(event.part.text);
        }
      } catch (_) {
        void _;
      }
    }
    return parts.join("");
  }

  private parseResponse(raw: string): EvaluationResponse {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { raw, parsed: null, error: "No JSON object found in response" };
      }
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      if (!parsed["decision_status"]) {
        return { raw, parsed: null, error: "Response missing decision_status field" };
      }
      return { raw, parsed: parsed as unknown as JanusOutput, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { raw, parsed: null, error: `JSON parse error: ${message}` };
    }
  }
}
