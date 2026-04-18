import { stringify } from "yaml";
import { deriveCanonicalKey } from "../rejected-path/identity.js";
const VALID_STATUSES = new Set(["recommend", "conditional", "blocked"]);
const VALID_QUALITY = new Set(["sufficient", "degraded", "insufficient"]);
const VALID_ROBUSTNESS = new Set(["low", "medium", "high"]);
const VALID_DOOM_SEVERITY = new Set(["fatal", "severe", "moderate", "low"]);
const VALID_DOOM_SURVIVABILITY = new Set(["unsurvivable", "conditional", "survivable"]);
const VALID_SURVIVAL_RATING = new Set(["fragile", "resilient", "antifragile"]);
const VALID_UNKNOWN_SOURCE = new Set(["missing_field", "inferred_assumption", "information_asymmetry", "external_dependency"]);
export function validateOutput(output) {
    const errors = [];
    if (!VALID_STATUSES.has(output.decision_status)) {
        errors.push(`Invalid decision_status: ${output.decision_status}`);
    }
    if (output.decision_status === "blocked" && output.best_path !== null) {
        errors.push("best_path must be null when decision_status is blocked");
    }
    if (output.decision_status !== "blocked" && output.best_path === null) {
        errors.push("best_path should not be null when decision_status is not blocked");
    }
    if (output.best_path && !VALID_ROBUSTNESS.has(output.best_path.robustness_score)) {
        errors.push(`Invalid robustness_score: ${output.best_path.robustness_score}`);
    }
    if (!VALID_QUALITY.has(output.information_quality)) {
        errors.push(`Invalid information_quality: ${output.information_quality}`);
    }
    if (output.candidate_paths) {
        if (output.candidate_paths.length > 3) {
            errors.push("candidate_paths must contain at most 3 entries");
        }
        const seenCandidateKeys = new Set();
        const bestPathSlug = output.best_path
            ? output.best_path.name
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/['’]/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .filter((token) => !["a", "an", "the", "to", "into", "then"].includes(token))
                .join("-")
            : null;
        for (const cp of output.candidate_paths) {
            if (!["document", "generated", "decomposed"].includes(cp.origin)) {
                errors.push(`Candidate path "${cp.name}" has invalid origin`);
            }
            if (!cp.fit_summary || cp.fit_summary.trim() === "") {
                errors.push(`Candidate path "${cp.name}" missing fit_summary`);
            }
            if (cp.fit_summary && cp.fit_summary.trim().length > 180) {
                errors.push(`Candidate path "${cp.name}" fit_summary exceeds 180 characters`);
            }
            const dedupeKey = `${cp.origin}:${cp.archetype_slug}`;
            if (seenCandidateKeys.has(dedupeKey)) {
                errors.push(`Candidate path "${cp.name}" duplicates an existing candidate`);
            }
            seenCandidateKeys.add(dedupeKey);
            if (bestPathSlug && cp.archetype_slug === bestPathSlug) {
                errors.push(`Candidate path "${cp.name}" duplicates best_path identity`);
            }
        }
    }
    for (const rp of output.rejected_paths) {
        if (!rp.rejection_reason || rp.rejection_reason.trim() === "") {
            errors.push(`Rejected path "${rp.name}" missing rejection_reason`);
        }
        const expectedCanonicalKey = deriveCanonicalKey(rp);
        if (rp.canonical_key && rp.canonical_key !== expectedCanonicalKey) {
            errors.push(`Rejected path "${rp.name}" has mismatched canonical_key`);
        }
        if (rp.failure_chain) {
            if (!Array.isArray(rp.failure_chain)) {
                errors.push(`Rejected path "${rp.name}" failure_chain must be an array`);
            }
            else {
                if (rp.failure_chain.length > 5) {
                    errors.push(`Rejected path "${rp.name}" failure_chain exceeds 5 steps`);
                }
                for (const step of rp.failure_chain) {
                    if (!step.event || step.event.trim() === "") {
                        errors.push(`Rejected path "${rp.name}" failure_chain step ${step.step} missing event`);
                    }
                    if (!step.trigger || step.trigger.trim() === "") {
                        errors.push(`Rejected path "${rp.name}" failure_chain step ${step.step} missing trigger`);
                    }
                }
            }
        }
        if (rp.comparison_basis) {
            const cb = rp.comparison_basis;
            const FRAGILITY = new Set(["lower", "equal", "higher"]);
            const UNKNOWNS = new Set(["fewer", "equal", "more"]);
            const NFR = new Set(["better", "equal", "worse"]);
            const REVERSIBILITY = new Set(["more", "equal", "less"]);
            const SCOPE = new Set(["smaller", "equal", "larger"]);
            if (!FRAGILITY.has(cb.fragility))
                errors.push(`Rejected path "${rp.name}" comparison_basis.fragility invalid`);
            if (!UNKNOWNS.has(cb.unknowns))
                errors.push(`Rejected path "${rp.name}" comparison_basis.unknowns invalid`);
            if (!NFR.has(cb.nfr_coverage))
                errors.push(`Rejected path "${rp.name}" comparison_basis.nfr_coverage invalid`);
            if (!REVERSIBILITY.has(cb.reversibility))
                errors.push(`Rejected path "${rp.name}" comparison_basis.reversibility invalid`);
            if (!SCOPE.has(cb.scope))
                errors.push(`Rejected path "${rp.name}" comparison_basis.scope invalid`);
        }
    }
    return errors;
}
export function formatOutput(output, format) {
    switch (format) {
        case "json":
            return JSON.stringify(output, null, 2);
        case "yaml":
            return stringify(output);
        case "markdown":
            return formatMarkdown(output);
    }
}
export function validateDoomOutput(output) {
    const errors = [];
    if (!VALID_SURVIVAL_RATING.has(output.survival_rating)) {
        errors.push(`Invalid survival_rating: ${output.survival_rating}`);
    }
    if (!Array.isArray(output.doom_scenarios)) {
        errors.push("doom_scenarios must be an array");
        return errors;
    }
    if (output.doom_scenarios.length < 3 || output.doom_scenarios.length > 7) {
        errors.push("doom_scenarios must contain between 3 and 7 entries");
    }
    if (output.doom_count !== output.doom_scenarios.length) {
        errors.push("doom_count must equal doom_scenarios.length");
    }
    if (!Array.isArray(output.critical_unknowns)) {
        errors.push("critical_unknowns must be an array");
        return errors;
    }
    for (const scenario of output.doom_scenarios) {
        if (!scenario.id || scenario.id.trim() === "") {
            errors.push("Doom scenario missing id");
        }
        if (!scenario.title || scenario.title.trim() === "") {
            errors.push(`Doom scenario "${scenario.id || "unknown"}" missing title`);
        }
        if (!VALID_DOOM_SEVERITY.has(scenario.severity)) {
            errors.push(`Doom scenario "${scenario.id}" has invalid severity`);
        }
        if (!VALID_DOOM_SURVIVABILITY.has(scenario.survivability)) {
            errors.push(`Doom scenario "${scenario.id}" has invalid survivability`);
        }
        if (scenario.survivability === "conditional" && (!scenario.survival_condition || scenario.survival_condition.trim() === "")) {
            errors.push(`Doom scenario "${scenario.id}" must include survival_condition when survivability is conditional`);
        }
        if (scenario.survivability !== "conditional" && scenario.survival_condition !== null) {
            errors.push(`Doom scenario "${scenario.id}" survival_condition must be null unless survivability is conditional`);
        }
        if (!Array.isArray(scenario.failure_chain) || scenario.failure_chain.length < 2 || scenario.failure_chain.length > 4) {
            errors.push(`Doom scenario "${scenario.id}" failure_chain must contain 2 to 4 steps`);
            continue;
        }
        for (const step of scenario.failure_chain) {
            if (!step.event || step.event.trim() === "") {
                errors.push(`Doom scenario "${scenario.id}" failure_chain step ${step.step} missing event`);
            }
            if (!step.trigger || step.trigger.trim() === "") {
                errors.push(`Doom scenario "${scenario.id}" failure_chain step ${step.step} missing trigger`);
            }
        }
    }
    for (const unknown of output.critical_unknowns) {
        if (!unknown.id || unknown.id.trim() === "") {
            errors.push("critical_unknowns entry missing id");
        }
        if (!unknown.description || unknown.description.trim() === "") {
            errors.push(`critical_unknown "${unknown.id || "unknown"}" missing description`);
        }
        if (!unknown.impact || unknown.impact.trim() === "") {
            errors.push(`critical_unknown "${unknown.id || "unknown"}" missing impact`);
        }
        if (!VALID_UNKNOWN_SOURCE.has(unknown.source)) {
            errors.push(`critical_unknown "${unknown.id || "unknown"}" has invalid source`);
        }
    }
    return errors;
}
export function formatDoomOutput(output, format) {
    switch (format) {
        case "json":
            return JSON.stringify(output, null, 2);
        case "yaml":
            return stringify(output);
        case "markdown":
            return formatDoomMarkdown(output);
    }
}
export function formatDoomMarkdown(o) {
    const lines = [];
    lines.push("# Doom Gate Report");
    lines.push("");
    lines.push(`**Survival Rating**: ${o.survival_rating}`);
    lines.push(`**Scenarios**: ${o.doom_count} found`);
    lines.push("");
    for (const scenario of o.doom_scenarios) {
        lines.push(`## ${scenario.id}: [${scenario.severity.toUpperCase()}] ${scenario.title}`);
        lines.push("");
        for (const step of scenario.failure_chain) {
            lines.push(`${step.step}. ${step.event} [${step.trigger}]`);
        }
        lines.push(`Survivability: ${scenario.survivability}${scenario.survivability === "conditional" && scenario.survival_condition ? ` — ${scenario.survival_condition}` : ""}`);
        lines.push("");
    }
    if (o.critical_unknowns.length > 0) {
        lines.push("## Critical Unknowns");
        lines.push("");
        for (const unknown of o.critical_unknowns) {
            lines.push(`### ${unknown.id}: ${unknown.description}`);
            lines.push(`- **Impact**: ${unknown.impact}`);
            lines.push(`- **Source**: ${unknown.source}`);
            if (unknown.question_for_human) {
                lines.push(`- **Question**: ${unknown.question_for_human}`);
            }
            lines.push("");
        }
    }
    return lines.join("\n");
}
function formatMarkdown(o) {
    const lines = [];
    lines.push(`# Janus Evaluation Result`);
    lines.push("");
    lines.push(`**Decision**: ${o.decision_status.toUpperCase()}`);
    lines.push(`**Information Quality**: ${o.information_quality}`);
    lines.push("");
    if (o.variance_report) {
        const vr = o.variance_report;
        lines.push(`## Variance Report (${vr.samples} samples)`);
        lines.push("");
        lines.push(`- **Decision agreement**: ${(vr.decision_status_agreement * 100).toFixed(0)}% (${vr.decision_status_trace.join(", ")})`);
        if (vr.tie_broken_to) {
            lines.push(`- **Tie broken to**: ${vr.tie_broken_to} (most conservative)`);
        }
        if (vr.best_path_agreement !== null) {
            lines.push(`- **Best-path agreement**: ${(vr.best_path_agreement * 100).toFixed(0)}%`);
        }
        else {
            lines.push(`- **Best-path agreement**: below quorum — best_path suppressed`);
        }
        const failed = vr.per_sample_errors.filter((e) => e !== null).length;
        if (failed > 0) {
            lines.push(`- **Failed samples**: ${failed}/${vr.samples}`);
        }
        lines.push("");
    }
    if (o.best_path) {
        lines.push(`## Recommended Path: ${o.best_path.name}`);
        lines.push("");
        lines.push(`**Robustness**: ${o.best_path.robustness_score}`);
        lines.push("");
        lines.push(`**Rationale**: ${o.best_path.rationale}`);
        lines.push("");
        if (o.best_path.enabling_conditions.length > 0) {
            lines.push(`### Enabling Conditions`);
            for (const c of o.best_path.enabling_conditions) {
                lines.push(`- ${c}`);
            }
            lines.push("");
        }
        if (o.best_path.fragility_warnings.length > 0) {
            lines.push(`### Fragility Warnings`);
            for (const w of o.best_path.fragility_warnings) {
                lines.push(`- ${w}`);
            }
            lines.push("");
        }
    }
    if (o.rejected_paths.length > 0) {
        lines.push(`## Rejected Paths`);
        lines.push("");
        for (const rp of o.rejected_paths) {
            lines.push(`### ${rp.name}`);
            lines.push(`- **Reason**: ${rp.rejection_reason}`);
            if (rp.violated_principle) {
                lines.push(`- **Violated Principle**: ${rp.violated_principle}`);
            }
            if (rp.failure_chain && rp.failure_chain.length > 0) {
                lines.push(`- **Failure Chain**:`);
                for (const step of rp.failure_chain) {
                    lines.push(`  ${step.step}. ${step.event} [${step.trigger}]`);
                }
            }
            if (rp.comparison_basis) {
                const cb = rp.comparison_basis;
                lines.push(`- **vs Best Path**: fragility=${cb.fragility}, unknowns=${cb.unknowns}, nfr=${cb.nfr_coverage}, reversibility=${cb.reversibility}, scope=${cb.scope}`);
            }
            if (rp.could_recover && rp.recovery_condition) {
                lines.push(`- **Could Recover If**: ${rp.recovery_condition}`);
            }
            lines.push("");
        }
    }
    if (o.candidate_paths && o.candidate_paths.length > 0) {
        lines.push(`## Candidate Paths`);
        lines.push("");
        for (const cp of o.candidate_paths) {
            lines.push(`### ${cp.name}`);
            lines.push(`- **Origin**: ${cp.origin}`);
            lines.push(`- **Fit**: ${cp.fit_summary}`);
            lines.push("");
        }
    }
    if (o.critical_unknowns.length > 0) {
        lines.push(`## Critical Unknowns`);
        lines.push("");
        for (const u of o.critical_unknowns) {
            lines.push(`### ${u.id}: ${u.description}`);
            lines.push(`- **Impact**: ${u.impact}`);
            lines.push(`- **Source**: ${u.source}`);
            if (u.question_for_human) {
                lines.push(`- **Question**: ${u.question_for_human}`);
            }
            lines.push("");
        }
    }
    if (o.next_actions.length > 0) {
        lines.push(`## Next Actions`);
        lines.push("");
        for (const a of o.next_actions) {
            lines.push(`- [${a.priority.toUpperCase()}] ${a.action} (addresses: ${a.addresses})`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
