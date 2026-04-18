import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export class ClaudeBackend {
    name = "claude";
    model;
    timeout;
    constructor(config) {
        this.model = config.model ?? "sonnet";
        this.timeout = config.timeout ?? 240_000;
    }
    async isAvailable() {
        try {
            await execFileAsync("which", ["claude"]);
            return true;
        }
        catch {
            return false;
        }
    }
    async evaluate(request) {
        const fullPrompt = [
            request.systemPrompt,
            "\n---\n",
            "## Document to Evaluate\n",
            request.document,
            "\n---\n",
            "## Required Output Format\n",
            request.outputSchema,
            "\n\nRespond with ONLY a valid JSON object matching the schema above. No markdown fences, no explanation outside the JSON.",
        ].join("\n");
        try {
            const stdout = await this.spawnWithStdin("claude", [
                "-p",
                "--output-format", "json",
                "--model", this.model,
                "--no-session-persistence",
                "--disable-slash-commands",
                "--tools", "",
            ], fullPrompt);
            return this.parseResponse(stdout);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw: "", parsed: null, error: `Claude backend error: ${message}` };
        }
    }
    spawnWithStdin(cmd, args, input) {
        return new Promise((resolve, reject) => {
            const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDE_")));
            const child = spawn(cmd, args, {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: this.timeout,
                env: cleanEnv,
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
            child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
            child.on("close", (code) => {
                if (code === 0 || stdout.length > 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Process exited with code ${code}: ${stderr.slice(0, 500)}`));
                }
            });
            child.on("error", reject);
            child.stdin.write(input);
            child.stdin.end();
        });
    }
    parseResponse(raw) {
        let innerText;
        try {
            const envelope = JSON.parse(raw.trim());
            if (envelope.is_error) {
                return { raw, parsed: null, error: `Claude CLI reported error (subtype=${envelope.subtype}): ${String(envelope.result ?? "").slice(0, 500)}` };
            }
            innerText = typeof envelope.result === "string" ? envelope.result : "";
            if (!innerText) {
                return { raw, parsed: null, error: "Claude envelope had no result field" };
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw, parsed: null, error: `Envelope parse error: ${message}` };
        }
        try {
            const jsonMatch = innerText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { raw, parsed: null, error: "No JSON object found in Claude result" };
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.decision_status) {
                return { raw, parsed: null, error: "Response missing decision_status field" };
            }
            return { raw, parsed, error: null };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw, parsed: null, error: `JSON parse error: ${message}` };
        }
    }
}
