import { normalizeRejectedPath } from "../rejected-path/identity.js";
const STATUS_SEVERITY = {
    blocked: 2,
    conditional: 1,
    recommend: 0,
};
const moreConservative = (a, b) => STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
const majorityStatus = (statuses) => {
    const counts = { recommend: 0, conditional: 0, blocked: 0 };
    for (const s of statuses)
        counts[s]++;
    const max = Math.max(counts.recommend, counts.conditional, counts.blocked);
    const tied = Object.keys(counts).filter((s) => counts[s] === max);
    if (tied.length === 1)
        return { winner: tied[0], tieBroken: false };
    return { winner: tied.reduce(moreConservative), tieBroken: true };
};
export function aggregateSamples(samples, errors) {
    if (samples.length === 0) {
        throw new Error("aggregateSamples: requires at least one sample");
    }
    const statuses = samples.map((s) => s.decision_status);
    const { winner: decisionStatus, tieBroken } = majorityStatus(statuses);
    const statusAgreement = statuses.filter((s) => s === decisionStatus).length / statuses.length;
    const bestNames = samples.map((s) => s.best_path?.name ?? "__none__");
    const bestCounts = new Map();
    for (const n of bestNames)
        bestCounts.set(n, (bestCounts.get(n) ?? 0) + 1);
    const maxBestCount = Math.max(...bestCounts.values());
    const quorum = Math.ceil(samples.length / 2);
    let bestPath = null;
    let bestPathAgreement = null;
    if (maxBestCount >= quorum) {
        const topName = [...bestCounts.entries()].find(([, c]) => c === maxBestCount)[0];
        if (topName !== "__none__") {
            bestPath = samples.find((s) => s.best_path?.name === topName).best_path;
            bestPathAgreement = maxBestCount / samples.length;
        }
    }
    const rejectedFreq = new Map();
    for (const s of samples) {
        for (const rp of s.rejected_paths) {
            const normalized = normalizeRejectedPath(rp);
            const key = normalized.canonical_key;
            const cur = rejectedFreq.get(key);
            if (cur)
                cur.count++;
            else
                rejectedFreq.set(key, { example: normalized, count: 1 });
        }
    }
    const rejectedPaths = [...rejectedFreq.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([, { example, count }]) => ({
        ...example,
        rejection_reason: `${example.rejection_reason} [appeared in ${count}/${samples.length} samples]`,
    }));
    const unknownFreq = new Map();
    for (const s of samples) {
        for (const u of s.critical_unknowns) {
            const key = u.description.trim().toLowerCase().slice(0, 120);
            const cur = unknownFreq.get(key);
            if (cur)
                cur.count++;
            else
                unknownFreq.set(key, { example: u, count: 1 });
        }
    }
    const criticalUnknowns = [...unknownFreq.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([, { example }]) => example);
    const assumptions = samples[0]?.assumptions ?? [];
    const nextActions = samples[0]?.next_actions ?? [];
    const qualityScore = {
        sufficient: 2,
        degraded: 1,
        insufficient: 0,
    };
    const worstQuality = samples.reduce((acc, s) => (qualityScore[s.information_quality] < qualityScore[acc] ? s.information_quality : acc), "sufficient");
    const rejectedFrequency = {};
    for (const [canonicalKey, { count }] of rejectedFreq)
        rejectedFrequency[canonicalKey] = count;
    const unknownFrequency = {};
    for (const [key, { count }] of unknownFreq)
        unknownFrequency[key] = count;
    const variance_report = {
        samples: samples.length,
        decision_status_trace: statuses,
        decision_status_agreement: statusAgreement,
        best_path_agreement: bestPathAgreement,
        tie_broken_to: tieBroken ? decisionStatus : null,
        rejected_path_frequency: rejectedFrequency,
        critical_unknown_frequency: unknownFrequency,
        per_sample_errors: errors,
    };
    return {
        decision_status: decisionStatus,
        best_path: bestPath,
        rejected_paths: rejectedPaths,
        critical_unknowns: criticalUnknowns,
        assumptions,
        information_quality: worstQuality,
        next_actions: nextActions,
        variance_report,
    };
}
