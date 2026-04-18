#!/usr/bin/env node
delete process.env["CI"];
import { Command } from "commander";
import { buildEvalRequest, buildCompareRequest } from "./prompt/builder.js";
import { createBackend } from "./backend/interface.js";
import { validateOutput, formatOutput } from "./parser/output.js";
import { runLoop } from "./loop/engine.js";
import { aggregateSamples } from "./sampling/aggregator.js";
import { normalizeOutputRejectedPaths } from "./rejected-path/identity.js";
import { normalizeCandidatePaths, suppressCandidatePaths } from "./candidate-path/identity.js";
import { analyzeDocumentStructure } from "./document-structure.js";
import { EXIT_RECOMMEND, EXIT_CONDITIONAL, EXIT_BLOCKED, EXIT_ERROR, } from "./types.js";
const program = new Command();
program
    .name("janus")
    .description("The two-faced gate that sees present and future, letting only the most robust paths pass")
    .version("0.2.2");
function exitCodeFor(status) {
    switch (status) {
        case "recommend": return EXIT_RECOMMEND;
        case "conditional": return EXIT_CONDITIONAL;
        case "blocked": return EXIT_BLOCKED;
    }
}
function resolveFormat(format) {
    if (format && ["json", "markdown", "yaml"].includes(format)) {
        return format;
    }
    return process.stdout.isTTY ? "markdown" : "json";
}
async function runEval(file, backendType, format, model, samples = 1) {
    const backend = createBackend({ type: backendType, model });
    const available = await backend.isAvailable();
    if (!available) {
        process.stderr.write(`Backend "${backendType}" is not available.\n`);
        process.exit(EXIT_ERROR);
    }
    const useCompact = ["codex", "claude", "opencode"].includes(backendType);
    const request = await buildEvalRequest(file, useCompact, true);
    const structure = analyzeDocumentStructure(request.document);
    const finalizeEvalOutput = (output) => {
        const normalized = normalizeOutputRejectedPaths(output);
        if (!structure.shouldSurfaceCandidatePaths || normalized.decision_status === "blocked") {
            return suppressCandidatePaths(normalized);
        }
        return normalizeCandidatePaths(normalized);
    };
    if (samples <= 1) {
        const response = await backend.evaluate(request);
        if (response.error || !response.parsed) {
            process.stderr.write(`Evaluation error: ${response.error ?? "Unknown error"}\n`);
            if (response.raw)
                process.stderr.write(`Raw response:\n${response.raw.slice(0, 500)}\n`);
            process.exit(EXIT_ERROR);
        }
        const normalized = finalizeEvalOutput(response.parsed);
        const validationErrors = validateOutput(normalized);
        for (const err of validationErrors)
            process.stderr.write(`  - ${err}\n`);
        return { output: normalized, exitCode: exitCodeFor(normalized.decision_status) };
    }
    const outputs = [];
    const errors = [];
    for (let i = 0; i < samples; i++) {
        process.stderr.write(`[sample ${i + 1}/${samples}] evaluating…\n`);
        const response = await backend.evaluate(request);
        if (response.error || !response.parsed) {
            errors.push(response.error ?? "unknown error");
            process.stderr.write(`  sample ${i + 1} failed: ${response.error}\n`);
        }
        else {
            errors.push(null);
            outputs.push(finalizeEvalOutput(response.parsed));
        }
    }
    if (outputs.length === 0) {
        process.stderr.write(`All ${samples} samples failed.\n`);
        process.exit(EXIT_ERROR);
    }
    const aggregated = aggregateSamples(outputs, errors);
    return { output: aggregated, exitCode: exitCodeFor(aggregated.decision_status) };
}
program
    .command("eval <file>")
    .description("Evaluate a PRD/spec document")
    .option("-f, --format <format>", "Output format: json, markdown, yaml")
    .option("-b, --backend <backend>", "AI backend: claude, codex, opencode, openai-api, anthropic-api, mock", "claude")
    .option("-m, --model <model>", "Model override for the backend")
    .option("--samples <n>", "Run eval N times and return consensus verdict (1-5; runtime scales linearly). Default 1.", "1")
    .action(async (file, opts) => {
    try {
        const format = resolveFormat(opts.format);
        const requested = parseInt(opts.samples ?? "1", 10);
        let samples = Number.isFinite(requested) ? requested : 1;
        if (samples < 1)
            samples = 1;
        if (samples > 5) {
            process.stderr.write(`--samples clamped from ${samples} to 5 (upper safety bound).\n`);
            samples = 5;
        }
        else if (samples > 3) {
            process.stderr.write(`--samples ${samples}: exceeds ≤3× baseline NFR. Proceeding at operator request.\n`);
        }
        const { output, exitCode } = await runEval(file, opts.backend, format, opts.model, samples);
        process.stdout.write(formatOutput(output, format) + "\n");
        if (process.stderr.isTTY && exitCode !== EXIT_ERROR) {
            process.stderr.write("\n\x1b[33m★\x1b[0m If Janus helped, consider starring the repo!\n");
            process.stderr.write("  \x1b[2mgh repo star devonestar/janus\x1b[0m\n");
        }
        process.exit(exitCode);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
        process.exit(EXIT_ERROR);
    }
});
program
    .command("compare <file-a> <file-b>")
    .description("Compare two option documents")
    .option("-f, --format <format>", "Output format: json, markdown, yaml")
    .option("-b, --backend <backend>", "AI backend", "claude")
    .option("-m, --model <model>", "Model override")
    .action(async (fileA, fileB, opts) => {
    try {
        const format = resolveFormat(opts.format);
        const backend = createBackend({ type: opts.backend, model: opts.model });
        const available = await backend.isAvailable();
        if (!available) {
            process.stderr.write(`Backend "${opts.backend}" is not available.\n`);
            process.exit(EXIT_ERROR);
        }
        const request = await buildCompareRequest(fileA, fileB);
        const response = await backend.evaluate(request);
        if (response.error || !response.parsed) {
            process.stderr.write(`Evaluation error: ${response.error ?? "Unknown error"}\n`);
            process.exit(EXIT_ERROR);
        }
        const normalized = suppressCandidatePaths(normalizeOutputRejectedPaths(response.parsed));
        process.stdout.write(formatOutput(normalized, format) + "\n");
        process.exit(exitCodeFor(normalized.decision_status));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
        process.exit(EXIT_ERROR);
    }
});
program
    .command("gate <file>")
    .description("Binary pass/fail gate for CI pipelines")
    .option("-b, --backend <backend>", "AI backend", "claude")
    .option("-m, --model <model>", "Model override")
    .action(async (file, opts) => {
    try {
        const { output, exitCode } = await runEval(file, opts.backend, "json", opts.model);
        if (output.decision_status === "recommend" && output.best_path?.robustness_score !== "low") {
            process.stdout.write(JSON.stringify({ gate: "PASS", decision_status: output.decision_status }) + "\n");
            process.exit(EXIT_RECOMMEND);
        }
        else {
            process.stdout.write(JSON.stringify({
                gate: "FAIL",
                decision_status: output.decision_status,
                reason: output.decision_status === "blocked"
                    ? "Evaluation blocked — human input required"
                    : `Robustness too low: ${output.best_path?.robustness_score ?? "none"}`,
            }) + "\n");
            process.exit(exitCode);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
        process.exit(EXIT_ERROR);
    }
});
program
    .command("loop <file>")
    .description("Run the autonomous Generate→Evaluate→Eliminate→Refine loop")
    .option("-f, --format <format>", "Output format: json, markdown")
    .option("-b, --backend <backend>", "AI backend", "claude")
    .option("-m, --model <model>", "Model override")
    .option("--max-iterations <n>", "Max loop iterations (1-5)", "5")
    .action(async (file, opts) => {
    try {
        const format = resolveFormat(opts.format);
        const backend = createBackend({ type: opts.backend, model: opts.model });
        const available = await backend.isAvailable();
        if (!available) {
            process.stderr.write(`Backend "${opts.backend}" is not available.\n`);
            process.exit(EXIT_ERROR);
        }
        const useCompact = ["codex", "claude", "opencode"].includes(opts.backend);
        const result = await runLoop(file, {
            backend,
            maxIterations: parseInt(opts.maxIterations, 10),
            compact: useCompact,
        });
        if (format === "json") {
            process.stdout.write(JSON.stringify({
                termination_reason: result.termination_reason,
                final_iteration: result.final_iteration,
                convergence_history: result.convergence_history,
                final_evaluation: result.final_evaluation,
                error: result.error,
            }, null, 2) + "\n");
        }
        else {
            process.stdout.write(`# Janus Loop Result\n\n`);
            process.stdout.write(`**Termination**: ${result.termination_reason}\n`);
            process.stdout.write(`**Final Iteration**: ${result.final_iteration}\n\n`);
            process.stdout.write(`## Convergence History\n\n`);
            for (const h of result.convergence_history) {
                process.stdout.write(`- Iteration ${h.iteration}: status=${h.decision_status}, rejected=${h.rejected_path_count}, unknowns=${h.critical_unknown_count}, trend=${h.convergence_trend ?? "initial"}\n`);
            }
            if (result.final_evaluation) {
                process.stdout.write("\n## Final Evaluation\n\n");
                process.stdout.write(formatOutput(result.final_evaluation, "markdown"));
            }
            if (result.error) {
                process.stdout.write(`\n## Error\n\n${result.error}\n`);
            }
        }
        if (result.termination_reason === "success")
            process.exit(EXIT_RECOMMEND);
        if (result.termination_reason === "acceptable")
            process.exit(EXIT_CONDITIONAL);
        if (result.termination_reason === "blocked")
            process.exit(EXIT_BLOCKED);
        if (result.termination_reason === "error")
            process.exit(EXIT_ERROR);
        process.exit(EXIT_CONDITIONAL);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
        process.exit(EXIT_ERROR);
    }
});
program.parse();
