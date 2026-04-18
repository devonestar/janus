import { execFile, spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createBackend } from "./backend/interface.js";
const execFileAsync = promisify(execFile);
const CHECK = "✓";
const FAIL = "✗";
const WARN = "~";
const DOCTOR_PROBE_PROMPT = "Respond with the single word: ok";
const DOCTOR_PROBE_TIMEOUT_MS = 4_750;
const DOCTOR_BACKENDS = ["claude", "codex", "opencode", "openai-api", "anthropic-api", "mock"];
const DOCTOR_PROBE_SUPPORTED_BACKENDS = new Set(["claude", "codex"]);
export const BACKEND_INSTALL_HINTS = {
    claude: ["Claude Code CLI not found.", "Install: https://claude.ai/code  (requires Claude subscription)"],
    codex: ["Codex CLI not found.", "Install: npm install -g @openai/codex"],
    opencode: ["OpenCode CLI not found.", "Install: https://opencode.ai"],
    "openai-api": ["OPENAI_API_KEY is not set.", "Set: export OPENAI_API_KEY=sk-..."],
    "anthropic-api": ["ANTHROPIC_API_KEY is not set.", "Set: export ANTHROPIC_API_KEY=sk-ant-..."],
};
export function resolveDoctorFormat(format) {
    return format === "json" ? "json" : "human";
}
export function doctorExitCode(report) {
    return report.ready ? 0 : 1;
}
export async function collectDoctorReport(options) {
    const [major] = process.versions.node.split(".").map(Number);
    const nodeOk = (major ?? 0) >= 18;
    const backends = await Promise.all(DOCTOR_BACKENDS.map(async (name) => {
        if (name === "mock") {
            return {
                name,
                available: true,
                detail: "always available (no LLM, structural checks only)",
                probe_supported: false,
                probe_attempted: false,
                probe_status: "skipped",
                probe_ok: null,
                probe_skip_reason: "structural-only backend",
            };
        }
        const available = await createBackend({ type: name }).isAvailable();
        const hints = BACKEND_INSTALL_HINTS[name];
        return {
            name,
            available,
            hint: available ? undefined : hints?.[0],
            detail: available ? undefined : hints?.[1],
            probe_supported: DOCTOR_PROBE_SUPPORTED_BACKENDS.has(name),
            probe_attempted: false,
            probe_status: "skipped",
            probe_ok: null,
        };
    }));
    let reportedBackends = backends;
    if (options.probe) {
        reportedBackends = await Promise.all(backends.map(async (backend) => {
            if (!backend.available) {
                return { ...backend, probe_skip_reason: "backend unavailable" };
            }
            if (!backend.probe_supported) {
                return { ...backend, probe_skip_reason: probeSkipReason(backend.name) };
            }
            const result = await probeBackend(backend.name);
            return {
                ...backend,
                probe_attempted: true,
                probe_status: result.ok ? "passed" : "failed",
                probe_ok: result.ok,
                probe_error: result.ok ? undefined : result.error ?? "Probe failed",
                detail: result.ok ? result.detail : backend.detail,
            };
        }));
    }
    const availableCount = reportedBackends.filter((backend) => backend.name !== "mock" && backend.available).length;
    const attemptedProbeCount = reportedBackends.filter((backend) => backend.probe_attempted).length;
    const probePassCount = reportedBackends.filter((backend) => backend.probe_status === "passed").length;
    return {
        node_version: process.versions.node,
        node_ok: nodeOk,
        probe_enabled: options.probe,
        backends: reportedBackends,
        available_count: availableCount,
        attempted_probe_count: attemptedProbeCount,
        probe_pass_count: probePassCount,
        ready: options.probe ? probePassCount > 0 : availableCount > 0,
    };
}
export function renderDoctorHuman(report) {
    const lines = [];
    lines.push("Janus environment check");
    lines.push("─".repeat(40));
    lines.push("");
    lines.push(`${report.node_ok ? CHECK : FAIL}  Node.js ${report.node_version}${report.node_ok ? "" : "  (need >=18)"}`);
    lines.push("");
    for (const backend of report.backends.filter((item) => item.name !== "mock")) {
        const symbol = backend.available ? CHECK : WARN;
        let line = `${symbol}  --backend ${backend.name}`;
        if (!backend.available && backend.hint) {
            line += `  — ${backend.hint}`;
        }
        lines.push(line);
        if (!backend.available && backend.detail) {
            lines.push(`       ${backend.detail}`);
            continue;
        }
        if (!report.probe_enabled || !backend.available) {
            continue;
        }
        if (!backend.probe_supported) {
            lines.push(`       probe: skipped (${backend.probe_skip_reason ?? "unsupported"})`);
            continue;
        }
        if (backend.probe_status === "passed") {
            lines.push("       probe: ok");
            continue;
        }
        if (backend.probe_status === "failed") {
            lines.push(`       probe: failed — ${(backend.probe_error ?? "Probe failed").slice(0, 160)}`);
        }
    }
    lines.push("");
    lines.push(`${WARN}  --backend mock  — always available (no LLM, structural checks only)`);
    lines.push("");
    lines.push("─".repeat(40));
    if (!report.probe_enabled) {
        if (report.available_count === 0) {
            lines.push("No LLM backend available. Install one above, or use --backend mock.");
        }
        else {
            lines.push(`${report.available_count}/5 LLM backend(s) available. Ready.`);
        }
        return lines.join("\n");
    }
    if (report.probe_pass_count > 0) {
        lines.push(`${report.probe_pass_count}/${report.attempted_probe_count} attempted probe(s) passed. Ready.`);
    }
    else if (report.attempted_probe_count === 0) {
        lines.push("No validated backend probe attempted. Probe support is currently limited to claude and codex.");
    }
    else {
        lines.push(`0/${report.attempted_probe_count} attempted probe(s) passed. No validated backend is healthy.`);
    }
    return lines.join("\n");
}
async function probeBackend(name) {
    switch (name) {
        case "claude":
            return probeClaude();
        case "codex":
            return probeCodex();
        default:
            return { ok: false, error: probeSkipReason(name) };
    }
}
function probeSkipReason(name) {
    switch (name) {
        case "opencode":
            return "unsupported/unvalidated in this release";
        case "openai-api":
        case "anthropic-api":
            return "structural-only in this release";
        case "mock":
            return "structural-only backend";
        default:
            return "probe unsupported";
    }
}
async function probeClaude() {
    try {
        const stdout = await spawnWithStdin("claude", [
            "-p",
            "--output-format", "json",
            "--model", "sonnet",
            "--no-session-persistence",
            "--disable-slash-commands",
            "--tools", "",
        ], DOCTOR_PROBE_PROMPT, DOCTOR_PROBE_TIMEOUT_MS);
        const envelope = JSON.parse(stdout.trim());
        if (typeof envelope !== "object" || envelope === null) {
            return { ok: false, error: "Claude probe returned an invalid envelope" };
        }
        const result = "result" in envelope && typeof envelope.result === "string" ? envelope.result.trim() : "";
        if (!result) {
            return { ok: false, error: "Claude probe returned an empty result" };
        }
        if ("is_error" in envelope && envelope.is_error === true) {
            return { ok: false, error: `Claude CLI reported error: ${result.slice(0, 200)}` };
        }
        return { ok: true, detail: result.slice(0, 200) };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Claude probe error: ${message}` };
    }
}
async function probeCodex() {
    const ts = Date.now();
    const promptFile = join(tmpdir(), `janus-codex-doctor-prompt-${ts}.txt`);
    const outputFile = join(tmpdir(), `janus-codex-doctor-output-${ts}.txt`);
    const errFile = join(tmpdir(), `janus-codex-doctor-err-${ts}.txt`);
    try {
        await writeFile(promptFile, DOCTOR_PROBE_PROMPT, "utf-8");
        const shellCmd = [
            "unset CI",
            "export PATH=\"$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin\"",
            `cat \"${promptFile}\" | codex exec - --sandbox read-only --skip-git-repo-check -o \"${outputFile}\" 2> \"${errFile}\"`,
        ].join("; ");
        const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["CI", "DEBIAN_FRONTEND"].includes(key)));
        await execFileAsync("bash", ["-c", shellCmd], {
            timeout: DOCTOR_PROBE_TIMEOUT_MS,
            maxBuffer: 4 * 1024 * 1024,
            env: cleanEnv,
        });
        const result = (await readFile(outputFile, "utf-8")).trim();
        if (!result) {
            return { ok: false, error: "Codex probe returned empty output" };
        }
        return { ok: true, detail: result.slice(0, 200) };
    }
    catch (err) {
        let errBody = "";
        try {
            errBody = (await readFile(errFile, "utf-8")).trim();
        }
        catch {
            // ignore cleanup/read failures
        }
        const message = err instanceof Error ? err.message : String(err);
        const suffix = errBody ? `: ${errBody.slice(-200)}` : "";
        return { ok: false, error: `Codex probe error: ${message}${suffix}` };
    }
    finally {
        try {
            await unlink(outputFile);
        }
        catch { }
        try {
            await unlink(promptFile);
        }
        catch { }
        try {
            await unlink(errFile);
        }
        catch { }
    }
}
function spawnWithStdin(cmd, args, input, timeout) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            stdio: ["pipe", "pipe", "pipe"],
            timeout,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
        child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdout);
                return;
            }
            reject(new Error(`process exited with code ${String(code)}: ${stderr.slice(0, 500)}`));
        });
        child.stdin.write(input);
        child.stdin.end();
    });
}
