import type { Claim, FetchedEvidence } from "../types.js";

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNpm(pkg: string): Promise<Record<string, unknown>> {
  const [meta, dl] = await Promise.allSettled([
    fetchWithTimeout(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`).then(r => r.ok ? r.json() as Promise<Record<string, unknown>> : null),
    fetchWithTimeout(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`).then(r => r.ok ? r.json() as Promise<Record<string, unknown>> : null),
  ]);
  return {
    version: meta.status === "fulfilled" && meta.value ? (meta.value as Record<string, unknown>)["version"] : null,
    description: meta.status === "fulfilled" && meta.value ? (meta.value as Record<string, unknown>)["description"] : null,
    downloads_last_month: dl.status === "fulfilled" && dl.value ? (dl.value as Record<string, unknown>)["downloads"] : null,
  };
}

async function fetchGitHub(repo: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "Accept": "application/vnd.github+json", "User-Agent": "janus-gate/enrich" };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers });
  if (!r.ok) return { error: r.status };
  const data = await r.json() as Record<string, unknown>;
  return {
    stars: data["stargazers_count"],
    forks: data["forks_count"],
    open_issues: data["open_issues_count"],
    description: data["description"],
    pushed_at: data["pushed_at"],
    license: (data["license"] as Record<string, unknown> | null)?.["spdx_id"] ?? null,
  };
}

async function fetchUrl(url: string): Promise<Record<string, unknown>> {
  const r = await fetchWithTimeout(url, { headers: { "User-Agent": "janus-gate/enrich" } });
  if (!r.ok) return { error: r.status, status: r.status };
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

export async function fetchEvidence(claims: Claim[]): Promise<FetchedEvidence[]> {
  const fetchable = claims.filter(c => c.type !== "statistical");
  const results: FetchedEvidence[] = [];

  for (const claim of claims) {
    if (claim.type === "statistical") {
      results.push({ claim, status: "skipped", data: null });
      continue;
    }
  }

  const evidences = await Promise.allSettled(
    fetchable.map(async (claim): Promise<FetchedEvidence> => {
      try {
        let data: Record<string, unknown>;
        if (claim.type === "npm") {
          data = await fetchNpm(claim.normalized);
        } else if (claim.type === "github") {
          data = await fetchGitHub(claim.normalized);
        } else {
          data = await fetchUrl(claim.normalized);
        }
        return { claim, status: "success", data };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { claim, status: "error", data: null, error: msg };
      }
    }),
  );

  const fetchedResults = evidences.map((r, i): FetchedEvidence => {
    if (r.status === "fulfilled") return r.value;
    return { claim: fetchable[i], status: "error", data: null, error: String(r.reason) };
  });

  const statisticalResults = results;
  return [...statisticalResults, ...fetchedResults];
}
