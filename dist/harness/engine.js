import { readFile } from "node:fs/promises";
import { buildEvalRequest } from "../prompt/builder.js";
import { buildTargetedDoomPrompt, TARGETED_DOOM_OUTPUT_SCHEMA } from "../prompt/doom-targeted.js";
import { analyzeDocumentStructure } from "../document-structure.js";
import { normalizeOutputRejectedPaths } from "../rejected-path/identity.js";
import { normalizeCandidatePaths, suppressCandidatePaths } from "../candidate-path/identity.js";
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function parseTargetedDoomReport(raw) {
    const attempt = (text) => {
        try {
            const parsed = JSON.parse(text.trim());
            if (typeof parsed === "object" &&
                parsed !== null &&
                "doom_scenarios" in parsed &&
                Array.isArray(parsed["doom_scenarios"])) {
                return parsed;
            }
        }
        catch {
            // fall through
        }
        return null;
    };
    // Try direct parse first
    const direct = attempt(raw);
    if (direct)
        return direct;
    // Try envelope unwrap (backend may return { result: "..." })
    try {
        const envelope = JSON.parse(raw.trim());
        if (typeof envelope === "object" &&
            envelope !== null &&
            "result" in envelope) {
            const inner = envelope["result"];
            const innerText = typeof inner === "string" ? inner : raw;
            const match = innerText.match(/\{[\s\S]*\}/);
            if (match)
                return attempt(match[0]);
        }
    }
    catch {
        // fall through
    }
    // Last resort: extract first JSON object from raw
    const match = raw.match(/\{[\s\S]*\}/);
    if (match)
        return attempt(match[0]);
    return null;
}
function buildCrosscheckMatrix(conditions, scenarios) {
    return conditions.map((condition, i) => {
        const ecId = `EC-${i + 1}`;
        const covering = scenarios.find(s => s.attacks_condition === ecId) ?? null;
        const doom_covered = covering !== null;
        let risk_level;
        if (!covering) {
            risk_level = "uncovered";
        }
        else {
            const sev = covering.severity;
            if (sev === "fatal" || sev === "severe" || sev === "moderate" || sev === "low") {
                risk_level = sev;
            }
            else {
                risk_level = "uncovered";
            }
        }
        return {
            enabling_condition: condition,
            doom_covered,
            covering_scenario: covering?.id ?? null,
            risk_level,
        };
    });
}
function computeHarnessVerdict(evalOutput, crosscheck) {
    const total = crosscheck.length;
    const attacked = crosscheck.filter(e => e.doom_covered).length;
    const condition_survival_rate = total > 0 ? attacked / total : 1;
    const unattacked_conditions = crosscheck
        .filter(e => !e.doom_covered)
        .map(e => e.enabling_condition);
    const fatal_conditions = crosscheck
        .filter(e => e.risk_level === "fatal")
        .map(e => e.enabling_condition);
    let final_recommendation;
    if (fatal_conditions.length > 0) {
        final_recommendation = "blocked";
    }
    else if (condition_survival_rate < 0.5) {
        final_recommendation = "conditional";
    }
    else {
        final_recommendation = evalOutput.decision_status;
    }
    const evalStatus = evalOutput.decision_status;
    let delta_from_eval = null;
    if (final_recommendation !== evalStatus) {
        delta_from_eval = `${evalStatus}→${final_recommendation} (fatal=${fatal_conditions.length}, uncovered=${unattacked_conditions.length})`;
    }
    return {
        condition_survival_rate,
        unattacked_conditions,
        fatal_conditions,
        final_recommendation,
        delta_from_eval,
    };
}
export async function runHarness(file, opts) {
    const { backend, compact = false } = opts;
    // ------------------------------------------------------------------
    // Pass 1: eval
    // ------------------------------------------------------------------
    process.stderr.write("[harness] Pass 1/3 — eval...\n");
    const evalRequest = await buildEvalRequest(file, compact, true);
    if (opts.documentOverride) {
        evalRequest.document = opts.documentOverride;
    }
    const structure = analyzeDocumentStructure(evalRequest.document);
    const evalResponse = await backend.evaluate(evalRequest);
    if (evalResponse.error || !evalResponse.parsed) {
        throw new Error(`Pass 1 (eval) failed: ${evalResponse.error ?? "no parsed output"}`);
    }
    let evalOutput = normalizeOutputRejectedPaths(evalResponse.parsed);
    if (!structure.shouldSurfaceCandidatePaths || evalOutput.decision_status === "blocked") {
        evalOutput = suppressCandidatePaths(evalOutput);
    }
    else {
        evalOutput = normalizeCandidatePaths(evalOutput);
    }
    const conditions = evalOutput.best_path?.enabling_conditions ?? [];
    if (conditions.length === 0) {
        process.stderr.write("[harness] No enabling conditions found — skipping targeted doom.\n");
        const emptyDoom = {
            doom_scenarios: [],
            survival_rating: "antifragile",
            doom_count: 0,
        };
        const emptyCrosscheck = [];
        const verdict = {
            condition_survival_rate: 1,
            unattacked_conditions: [],
            fatal_conditions: [],
            final_recommendation: evalOutput.decision_status,
            delta_from_eval: null,
        };
        return {
            eval_verdict: evalOutput,
            doom_verdict: emptyDoom,
            crosscheck_matrix: emptyCrosscheck,
            harness_verdict: verdict,
        };
    }
    // ------------------------------------------------------------------
    // Pass 2: targeted doom
    // ------------------------------------------------------------------
    process.stderr.write(`[harness] Pass 2/3 — targeted doom (${conditions.length} conditions)...\n`);
    const document = opts.documentOverride ?? await readFile(file, "utf-8");
    const doomRequest = {
        document,
        systemPrompt: buildTargetedDoomPrompt(conditions),
        outputSchema: TARGETED_DOOM_OUTPUT_SCHEMA,
    };
    const doomResponse = await backend.evaluate(doomRequest);
    const doomReport = parseTargetedDoomReport(doomResponse.raw);
    if (!doomReport) {
        throw new Error(`Pass 2 (targeted doom) failed: could not parse response. Raw:\n${doomResponse.raw.slice(0, 500)}`);
    }
    // ------------------------------------------------------------------
    // Pass 3: deterministic crosscheck
    // ------------------------------------------------------------------
    process.stderr.write("[harness] Pass 3/3 — crosscheck matrix...\n");
    const crosscheck = buildCrosscheckMatrix(conditions, doomReport.doom_scenarios);
    const verdict = computeHarnessVerdict(evalOutput, crosscheck);
    process.stderr.write(`[harness] Done. survival_rate=${(verdict.condition_survival_rate * 100).toFixed(0)}%, ` +
        `fatal=${verdict.fatal_conditions.length}, uncovered=${verdict.unattacked_conditions.length}, ` +
        `final=${verdict.final_recommendation}\n`);
    return {
        eval_verdict: evalOutput,
        doom_verdict: doomReport,
        crosscheck_matrix: crosscheck,
        harness_verdict: verdict,
    };
}
// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function formatHarnessOutput(report, format) {
    if (format === "json") {
        return JSON.stringify(report, null, 2);
    }
    const lines = [];
    const { eval_verdict, doom_verdict, crosscheck_matrix, harness_verdict } = report;
    lines.push("# Janus Harness Report\n");
    // Eval summary
    lines.push("## Pass 1 — Eval Verdict\n");
    lines.push(`- **Decision**: ${eval_verdict.decision_status.toUpperCase()}`);
    lines.push(`- **Information quality**: ${eval_verdict.information_quality}`);
    if (eval_verdict.best_path) {
        lines.push(`- **Best path**: ${eval_verdict.best_path.name}`);
        lines.push(`- **Robustness**: ${eval_verdict.best_path.robustness_score}`);
        if (eval_verdict.best_path.enabling_conditions.length > 0) {
            lines.push(`- **Enabling conditions**:`);
            eval_verdict.best_path.enabling_conditions.forEach((ec, i) => {
                lines.push(`  - EC-${i + 1}: ${ec}`);
            });
        }
    }
    lines.push("");
    // Doom scenarios
    lines.push("## Pass 2 — Targeted Doom Scenarios\n");
    lines.push(`Survival rating: **${doom_verdict.survival_rating}** | Scenarios: ${doom_verdict.doom_count}\n`);
    for (const s of doom_verdict.doom_scenarios) {
        lines.push(`### ${s.id}: ${s.title}`);
        lines.push(`- Severity: ${s.severity} | Survivability: ${s.survivability}`);
        lines.push(`- Attacks condition: **${s.attacks_condition ?? "none"}**`);
        if (s.failure_chain && s.failure_chain.length > 0) {
            lines.push("- Failure chain:");
            for (const step of s.failure_chain) {
                lines.push(`  ${step.step}. ${step.event}`);
            }
        }
        lines.push("");
    }
    // Crosscheck matrix
    lines.push("## Pass 3 — Crosscheck Matrix\n");
    lines.push("| Enabling Condition | Covered | Scenario | Risk |");
    lines.push("|---|---|---|---|");
    for (const entry of crosscheck_matrix) {
        const covered = entry.doom_covered ? "✓" : "✗";
        const scenario = entry.covering_scenario ?? "—";
        lines.push(`| ${entry.enabling_condition} | ${covered} | ${scenario} | ${entry.risk_level} |`);
    }
    lines.push("");
    // Harness verdict
    lines.push("## Harness Verdict\n");
    lines.push(`- **Final recommendation**: ${harness_verdict.final_recommendation.toUpperCase()}`);
    lines.push(`- **Condition survival rate**: ${(harness_verdict.condition_survival_rate * 100).toFixed(0)}%`);
    if (harness_verdict.delta_from_eval) {
        lines.push(`- **Delta from eval**: ${harness_verdict.delta_from_eval}`);
    }
    if (harness_verdict.fatal_conditions.length > 0) {
        lines.push(`- **Fatal conditions**:`);
        for (const fc of harness_verdict.fatal_conditions) {
            lines.push(`  - ${fc}`);
        }
    }
    if (harness_verdict.unattacked_conditions.length > 0) {
        lines.push(`- **Uncovered conditions**:`);
        for (const uc of harness_verdict.unattacked_conditions) {
            lines.push(`  - ${uc}`);
        }
    }
    return lines.join("\n");
}
