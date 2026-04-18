const FETCH_TIMEOUT_MS = 8000;
async function fetchWithTimeout(url, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { ...opts, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
async function fetchNpm(pkg) {
    const [meta, dl] = await Promise.allSettled([
        fetchWithTimeout(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`).then(r => r.ok ? r.json() : null),
        fetchWithTimeout(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`).then(r => r.ok ? r.json() : null),
    ]);
    return {
        version: meta.status === "fulfilled" && meta.value ? meta.value["version"] : null,
        description: meta.status === "fulfilled" && meta.value ? meta.value["description"] : null,
        downloads_last_month: dl.status === "fulfilled" && dl.value ? dl.value["downloads"] : null,
    };
}
async function fetchGitHub(repo) {
    const headers = { "Accept": "application/vnd.github+json", "User-Agent": "janus-gate/enrich" };
    const token = process.env["GITHUB_TOKEN"];
    if (token)
        headers["Authorization"] = `Bearer ${token}`;
    const r = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers });
    if (!r.ok)
        return { error: r.status };
    const data = await r.json();
    return {
        stars: data["stargazers_count"],
        forks: data["forks_count"],
        open_issues: data["open_issues_count"],
        description: data["description"],
        pushed_at: data["pushed_at"],
        license: data["license"]?.["spdx_id"] ?? null,
    };
}
async function fetchUrl(url) {
    const r = await fetchWithTimeout(url, { headers: { "User-Agent": "janus-gate/enrich" } });
    if (!r.ok)
        return { error: r.status, status: r.status };
    const text = await r.text();
    const titleMatch = text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i);
    return {
        status: r.status,
        title: titleMatch?.[1]?.trim() ?? null,
        description: descMatch?.[1]?.trim() ?? null,
        content_length: text.length,
    };
}
export async function fetchEvidence(claims) {
    const fetchable = claims.filter(c => c.type !== "statistical");
    const results = [];
    for (const claim of claims) {
        if (claim.type === "statistical") {
            results.push({ claim, status: "skipped", data: null });
            continue;
        }
    }
    const evidences = await Promise.allSettled(fetchable.map(async (claim) => {
        try {
            let data;
            if (claim.type === "npm") {
                data = await fetchNpm(claim.normalized);
            }
            else if (claim.type === "github") {
                data = await fetchGitHub(claim.normalized);
            }
            else {
                data = await fetchUrl(claim.normalized);
            }
            return { claim, status: "success", data };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { claim, status: "error", data: null, error: msg };
        }
    }));
    const fetchedResults = evidences.map((r, i) => {
        if (r.status === "fulfilled")
            return r.value;
        return { claim: fetchable[i], status: "error", data: null, error: String(r.reason) };
    });
    const statisticalResults = results;
    return [...statisticalResults, ...fetchedResults];
}
