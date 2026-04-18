import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const execFileAsync = promisify(execFile);
export class OpenCodeBackend {
    name = "opencode";
    timeout;
    constructor(config) {
        this.timeout = config.timeout ?? 240_000;
    }
    async isAvailable() {
        try {
            await execFileAsync("which", ["opencode"]);
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
            "\n\nRespond with ONLY a valid JSON object matching the schema above.",
        ].join("\n");
        const tmpFile = join(tmpdir(), `janus-opencode-${Date.now()}.md`);
        await writeFile(tmpFile, fullPrompt, "utf-8");
        try {
            const stdout = await this.spawnCollect("opencode", ["run", "--format", "json", "-f", tmpFile, "--", "Respond with ONLY a valid JSON object as instructed in the attached file."], this.timeout);
            const text = this.extractTextFromEvents(stdout);
            return this.parseResponse(text);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw: "", parsed: null, error: `OpenCode backend error: ${message}` };
        }
        finally {
            await unlink(tmpFile).catch(() => { });
        }
    }
    spawnCollect(cmd, args, timeoutMs) {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
            let stdout = "";
            let stderr = "";
            let settled = false;
            const settle = (fn) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                child.kill();
                fn();
            };
            child.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
                if (stdout.includes('"step_finish"') || stdout.includes('"step-finish"')) {
                    settle(() => resolve(stdout));
                }
            });
            child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
            const timer = setTimeout(() => {
                settle(() => {
                    if (stdout.trim())
                        resolve(stdout);
                    else
                        reject(new Error(`opencode timed out after ${timeoutMs}ms`));
                });
            }, timeoutMs);
            child.on("close", () => {
                settle(() => {
                    if (stdout.trim())
                        resolve(stdout);
                    else
                        reject(new Error(stderr.trim() || "opencode produced no output"));
                });
            });
            child.on("error", (err) => {
                settle(() => reject(err));
            });
        });
    }
    extractTextFromEvents(stdout) {
        const lines = stdout.split("\n").filter((l) => l.trim());
        const parts = [];
        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                if (event.type === "text" && event.part?.text) {
                    parts.push(event.part.text);
                }
            }
            catch (_) {
                void _;
            }
        }
        return parts.join("");
    }
    parseResponse(raw) {
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { raw, parsed: null, error: "No JSON object found in response" };
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed["decision_status"]) {
                return { raw, parsed: null, error: "Response missing decision_status field" };
            }
            return { raw, parsed: parsed, error: null };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw, parsed: null, error: `JSON parse error: ${message}` };
        }
    }
}
