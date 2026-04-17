import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export class OpenCodeBackend {
    name = "opencode";
    timeout;
    constructor(config) {
        this.timeout = config.timeout ?? 120_000;
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
        try {
            const { stdout } = await execFileAsync("opencode", ["--non-interactive", "-p", fullPrompt], { timeout: this.timeout, maxBuffer: 1024 * 1024 });
            return this.parseResponse(stdout);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw: "", parsed: null, error: `OpenCode backend error: ${message}` };
        }
    }
    parseResponse(raw) {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { raw, parsed: null, error: `JSON parse error: ${message}` };
        }
    }
}
