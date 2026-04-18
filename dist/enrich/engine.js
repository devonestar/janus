import { readFile } from "node:fs/promises";
import { extractClaims } from "./extractor.js";
import { fetchEvidence } from "./fetcher.js";
import { buildInterpreterPrompt, ENRICH_OUTPUT_SCHEMA } from "./interpreter.js";
function unwrapRaw(raw) {
    try {
        const envelope = JSON.parse(raw.trim());
        if (typeof envelope === "object" && envelope !== null && "result" in envelope) {
            const inner = envelope["result"];
            if (typeof inner === "string")
                return inner;
        }
    }
    catch {
        // fall through
    }
    return raw;
}
function parseFindings(raw) {
    const attempt = (text) => {
        try {
            const parsed = JSON.parse(text.trim());
            if (typeof parsed === "object" &&
                parsed !== null &&
                "findings" in parsed &&
                Array.isArray(parsed["findings"])) {
                return parsed.findings;
            }
        }
        catch {
            // fall through
        }
        return null;
    };
    const direct = attempt(raw);
    if (direct)
        return direct;
    const match = raw.match(/\{[\s\S]*\}/);
    if (match)
        return attempt(match[0]) ?? [];
    return [];
}
function parseSummary(raw) {
    try {
        const parsed = JSON.parse(raw.trim());
        if (typeof parsed === "object" && parsed !== null && "summary" in parsed) {
            const s = parsed["summary"];
            if (typeof s === "string")
                return s;
        }
    }
    catch {
        // fall through
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            const p = JSON.parse(match[0]);
            if (typeof p === "object" && p !== null && "summary" in p) {
                const s = p["summary"];
                if (typeof s === "string")
                    return s;
            }
        }
        catch {
            // fall through
        }
    }
    return "";
}
export async function runEnrich(file, opts) {
    const document = await readFile(file, "utf-8");
    process.stderr.write("[enrich] Step 1/3 — extracting claims...\n");
    const claims = extractClaims(document);
    process.stderr.write(`[enrich] Found ${claims.length} claims (${claims.filter(c => c.type !== "statistical").length} fetchable).\n`);
    if (claims.length === 0) {
        return { file, claims_found: [], evidence: [], findings: [], summary: "No external claims found in document." };
    }
    process.stderr.write("[enrich] Step 2/3 — fetching evidence...\n");
    const evidence = await fetchEvidence(claims);
    const successCount = evidence.filter(e => e.status === "success").length;
    process.stderr.write(`[enrich] Fetched ${successCount}/${evidence.filter(e => e.status !== "skipped").length} sources successfully.\n`);
    const prompt = buildInterpreterPrompt(document, evidence);
    if (!prompt) {
        return { file, claims_found: claims, evidence, findings: [], summary: "No fetchable evidence succeeded." };
    }
    process.stderr.write("[enrich] Step 3/3 — LLM interpretation...\n");
    const response = await opts.backend.evaluate({
        document: "",
        systemPrompt: prompt,
        outputSchema: ENRICH_OUTPUT_SCHEMA,
    });
    if (!response.raw || response.raw.trim().length < 10) {
        throw new Error(`Interpretation returned empty response.`);
    }
    const innerText = unwrapRaw(response.raw);
    const findings = parseFindings(innerText);
    const summary = parseSummary(innerText);
    process.stderr.write(`[enrich] Done. ${findings.length} findings.\n`);
    return { file, claims_found: claims, evidence, findings, summary };
}
export function formatEnrichOutput(report, format) {
    if (format === "json") {
        return JSON.stringify(report, null, 2);
    }
    const lines = [];
    lines.push("# Janus Enrich Report\n");
    lines.push(`File: \`${report.file}\`\n`);
    lines.push("## Claims Found\n");
    if (report.claims_found.length === 0) {
        lines.push("No external claims found.");
    }
    else {
        lines.push("| Type | Normalized |");
        lines.push("|---|---|");
        for (const c of report.claims_found) {
            lines.push(`| ${c.type} | ${c.normalized} |`);
        }
    }
    lines.push("");
    lines.push("## Evidence Fetched\n");
    for (const e of report.evidence) {
        if (e.status === "skipped")
            continue;
        const icon = e.status === "success" ? "✓" : "✗";
        lines.push(`${icon} **${e.claim.type}** \`${e.claim.normalized}\` — ${e.status}`);
        if (e.status === "success" && e.data) {
            const key = Object.keys(e.data).slice(0, 3).map(k => `${k}: ${e.data[k]}`).join(", ");
            lines.push(`  ${key}`);
        }
        if (e.error)
            lines.push(`  Error: ${e.error}`);
    }
    lines.push("");
    lines.push("## Findings\n");
    if (report.findings.length === 0) {
        lines.push("No findings.");
    }
    else {
        for (const f of report.findings) {
            lines.push(`### ${f.source}`);
            lines.push(`**Finding**: ${f.finding}`);
            if (f.supports_assumption)
                lines.push(`**Supports**: ${f.supports_assumption}`);
            if (f.contradicts_assumption)
                lines.push(`**Contradicts**: ${f.contradicts_assumption}`);
            lines.push(`**Confidence**: ${f.confidence}`);
            lines.push("");
        }
    }
    lines.push("## Summary\n");
    lines.push(report.summary || "No summary.");
    return lines.join("\n");
}
