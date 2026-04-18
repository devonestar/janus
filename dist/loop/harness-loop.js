import { readFile, writeFile, realpath } from "node:fs/promises";
import { dirname, basename, resolve } from "node:path";
import { runHarness } from "../harness/engine.js";
import { buildRefinerPrompt } from "../prompt/refiner.js";
import { checkConvergence } from "./convergence.js";
async function safeResolve(inputPath, outputPath) {
    let resolvedInput;
    try {
        resolvedInput = await realpath(inputPath);
    }
    catch {
        return { safe: false, error: `Cannot resolve input path: ${inputPath}` };
    }
    let resolvedOutput;
    try {
        resolvedOutput = await realpath(outputPath);
    }
    catch {
        try {
            const parentResolved = await realpath(dirname(outputPath));
            resolvedOutput = resolve(parentResolved, basename(outputPath));
        }
        catch {
            return { safe: false, error: `Cannot resolve output path or its parent: ${outputPath}` };
        }
    }
    if (resolvedInput === resolvedOutput) {
        return { safe: false, error: `--output path resolves to the same file as input — refusing to overwrite` };
    }
    return { safe: true };
}
function validateRefinerOutput(text) {
    const trimmed = text.trim();
    if (trimmed.length < 50)
        return false;
    const lines = trimmed.split("\n");
    const hasHeading = lines.some(l => /^#{1,6}\s/.test(l));
    return hasHeading;
}
function applyPatch(document, patch) {
    const headingRe = /^(#{1,6}\s+.+)$/m;
    const patchLines = patch.trim().split("\n");
    const firstHeadingMatch = patchLines[0]?.match(/^#{1,6}\s/);
    if (!firstHeadingMatch) {
        return document;
    }
    const patchSections = patch.trim().split(/(?=^#{1,6}\s)/m);
    let result = document;
    for (const section of patchSections) {
        const sectionLines = section.trim().split("\n");
        const headingLine = sectionLines[0];
        if (!headingLine || !headingRe.test(headingLine))
            continue;
        const escapedHeading = headingLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const sectionRe = new RegExp(`(${escapedHeading}[\\s\\S]*?)(?=^#{1,6}\\s|$)`, "m");
        if (sectionRe.test(result)) {
            result = result.replace(sectionRe, section.trim() + "\n\n");
        }
    }
    return result;
}
export async function runHarnessLoop(filePath, opts) {
    const { backend, compact = false, maxIterations = 5, outputPath } = opts;
    if (outputPath) {
        const safety = await safeResolve(filePath, outputPath);
        if (!safety.safe) {
            return {
                termination_reason: "error",
                final_iteration: 0,
                best_iteration: 0,
                iterations: [],
                final_report: null,
                best_report: null,
                error: safety.error ?? "File safety check failed",
            };
        }
    }
    const originalDocument = await readFile(filePath, "utf-8");
    let currentDocument = originalDocument;
    const iterationHistory = [];
    const convergenceHistory = [];
    for (let iter = 1; iter <= maxIterations; iter++) {
        let report = null;
        let fatal = 0;
        let uncovered = 0;
        let score = Infinity;
        let verdict = "error";
        try {
            report = await runHarness(filePath, { backend, compact, documentOverride: currentDocument });
            fatal = report.harness_verdict.fatal_conditions.length;
            uncovered = report.harness_verdict.unattacked_conditions.length;
            verdict = report.harness_verdict.final_recommendation;
            score = fatal * 2 + uncovered;
        }
        catch {
            score = Infinity;
            verdict = "error";
        }
        process.stderr.write(`[harness-loop] iter=${iter} fatal=${score === Infinity ? "?" : fatal} uncovered=${score === Infinity ? "?" : uncovered} verdict=${verdict}\n`);
        iterationHistory.push({ iteration: iter, fatal, uncovered, verdict, score, report, document: currentDocument });
        const isBlocked = report?.harness_verdict.final_recommendation === "blocked";
        const overrideReason = isBlocked && score > 0 && convergenceHistory.length > 0 && convergenceHistory[convergenceHistory.length - 1].score <= score
            ? "blocked"
            : undefined;
        convergenceHistory.push({ iteration: iter, score, termination_reason_override: overrideReason });
        const conv = checkConvergence(convergenceHistory, maxIterations);
        if (conv.terminate) {
            const bestIdx = conv.best_iteration_index;
            const bestEntry = iterationHistory[bestIdx] ?? iterationHistory[iterationHistory.length - 1];
            const finalEntry = iterationHistory[iterationHistory.length - 1];
            const emitEntry = (conv.reason === "success" || conv.reason === "acceptable")
                ? finalEntry
                : bestEntry;
            const allInfinity = iterationHistory.every(h => h.score === Infinity);
            const docToEmit = allInfinity ? originalDocument : emitEntry.document;
            if (outputPath && docToEmit) {
                if (allInfinity) {
                    process.stderr.write(`[harness-loop] All iterations failed — emitting original document with warning.\n`);
                }
                await writeFile(outputPath, docToEmit, "utf-8");
                process.stderr.write(`[harness-loop] Written to ${outputPath}\n`);
            }
            return {
                termination_reason: conv.reason ?? "max_iteration",
                final_iteration: iter,
                best_iteration: bestEntry.iteration,
                iterations: iterationHistory.map(h => ({ iteration: h.iteration, fatal: h.fatal, uncovered: h.uncovered, verdict: h.verdict, score: h.score })),
                final_report: finalEntry.report,
                best_report: bestEntry.report,
                error: null,
            };
        }
        if (!report)
            continue;
        const fatalConditions = report.harness_verdict.fatal_conditions;
        const unattackedConditions = report.harness_verdict.unattacked_conditions;
        if (fatalConditions.length === 0 && unattackedConditions.length === 0)
            continue;
        const refinerPrompt = buildRefinerPrompt(currentDocument, fatalConditions, unattackedConditions);
        const refinerRequest = {
            document: currentDocument,
            systemPrompt: refinerPrompt,
            outputSchema: "",
        };
        try {
            const refinerResponse = await backend.evaluate(refinerRequest);
            const patch = refinerResponse.raw?.trim() ?? "";
            if (validateRefinerOutput(patch)) {
                const patched = applyPatch(currentDocument, patch);
                if (patched !== currentDocument) {
                    currentDocument = patched;
                }
            }
            else {
                process.stderr.write(`[harness-loop] Refiner output rejected (too short or no heading) — carrying forward\n`);
            }
        }
        catch {
            process.stderr.write(`[harness-loop] Refiner call failed — carrying forward\n`);
        }
    }
    const lastEntry = iterationHistory[iterationHistory.length - 1];
    return {
        termination_reason: "max_iteration",
        final_iteration: maxIterations,
        best_iteration: lastEntry?.iteration ?? maxIterations,
        iterations: iterationHistory.map(h => ({ iteration: h.iteration, fatal: h.fatal, uncovered: h.uncovered, verdict: h.verdict, score: h.score })),
        final_report: lastEntry?.report ?? null,
        best_report: lastEntry?.report ?? null,
        error: null,
    };
}
