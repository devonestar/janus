import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JanusBackend } from "./interface.js";
import type { EvaluationRequest, EvaluationResponse, BackendConfig } from "../types.js";

const execFileAsync = promisify(execFile);

export class CodexBackend implements JanusBackend {
  readonly name = "codex";
  private model: string | undefined;
  private timeout: number;

  constructor(config: BackendConfig) {
    // Leave unset on no override so codex uses ~/.codex/config.toml default; hardcoding a model breaks accounts that lack access to it.
    this.model = config.model;
    this.timeout = config.timeout ?? 180_000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync("which", ["codex"]);
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
      "\n\nRespond with ONLY a valid JSON object matching the schema above. Do not execute any commands. Do not modify any files. Just output the JSON.",
    ].join("\n");

    const ts = Date.now();
    const promptFile = join(tmpdir(), `janus-codex-prompt-${ts}.txt`);
    const outputFile = join(tmpdir(), `janus-codex-output-${ts}.txt`);
    const errFile = join(tmpdir(), `janus-codex-err-${ts}.txt`);

    try {
      await writeFile(promptFile, fullPrompt, "utf-8");

      const modelFlag = this.model ? `--model "${this.model}"` : "";
      const shellCmd = [
        `unset CI`,
        `export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"`,
        `cat "${promptFile}" | codex exec - ${modelFlag} --sandbox read-only --skip-git-repo-check -o "${outputFile}" 2> "${errFile}"`,
        `true`,
      ].join("; ");

      const cleanEnv = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !["CI", "DEBIAN_FRONTEND"].includes(k))
      );
      await execFileAsync("bash", ["-c", shellCmd], {
        timeout: this.timeout,
        maxBuffer: 4 * 1024 * 1024,
        env: cleanEnv,
      }).catch(() => {});

      let result = "";
      try {
        result = (await readFile(outputFile, "utf-8")).trim();
      } catch {}

      let errBody = "";
      try {
        errBody = (await readFile(errFile, "utf-8")).trim();
      } catch {}

      try { await unlink(outputFile); } catch {}
      try { await unlink(promptFile); } catch {}
      try { await unlink(errFile); } catch {}

      if (!result) {
        const hint = errBody ? `Codex produced no output. codex stderr: ${errBody.slice(-800)}` : "Codex produced no output";
        return { raw: "", parsed: null, error: hint };
      }

      return this.parseResponse(result);
    } catch (err: unknown) {
      try { await unlink(outputFile); } catch {}
      try { await unlink(promptFile); } catch {}
      try { await unlink(errFile); } catch {}
      const message = err instanceof Error ? err.message : String(err);
      return { raw: "", parsed: null, error: `Codex backend error: ${message}` };
    }
  }

  private spawnWithStdin(cmd: string, args: string[], input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: this.timeout,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on("close", (code) => {
        if (code === 0 || stdout.length > 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Codex exited with code ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      child.on("error", reject);

      child.stdin.write(input);
      child.stdin.end();
    });
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
