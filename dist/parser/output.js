import { stringify } from "yaml";
import { deriveCanonicalKey } from "../rejected-path/identity.js";
const VALID_STATUSES = new Set(["recommend", "conditional", "blocked"]);
const VALID_QUALITY = new Set(["sufficient", "degraded", "insufficient"]);
const VALID_ROBUSTNESS = new Set(["low", "medium", "high"]);
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
