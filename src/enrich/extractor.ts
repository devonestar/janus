import type { Claim } from "../types.js";

const URL_RE = /https?:\/\/[^\s)>\]"',]+/g;
const GITHUB_RE = /github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/g;
const NPM_INSTALL_RE = /npm\s+(?:install|i)\s+(?:-g\s+)?([a-zA-Z0-9@/_.-]+)/g;
const NPM_BACKTICK_RE = /`([a-zA-Z0-9][a-zA-Z0-9_.-]*(?:@[^\s`]+)?)`/g;
const STAT_RE = /\b(\d[\d,]*(?:\.\d+)?)\s*(?:K\+?|k\+?)?\s*(?:stars?|downloads?|users?|installs?|forks?)\b/gi;

export function extractClaims(document: string): Claim[] {
  const seen = new Set<string>();
  const claims: Claim[] = [];

  function add(type: Claim["type"], raw: string, normalized: string): void {
    const key = `${type}:${normalized}`;
    if (!seen.has(key)) {
      seen.add(key);
      claims.push({ type, raw, normalized });
    }
  }

  for (const m of document.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;]$/, "");
    const ghMatch = url.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (ghMatch) {
      add("github", url, ghMatch[1]);
    } else if (url.includes("npmjs.com/package/")) {
      const pkg = url.split("/package/")[1]?.split("/")[0] ?? "";
      if (pkg) add("npm", url, pkg);
    } else {
      add("url", url, url);
    }
  }

  for (const m of document.matchAll(GITHUB_RE)) {
    add("github", m[0], m[1]);
  }

  for (const m of document.matchAll(NPM_INSTALL_RE)) {
    const pkg = m[1].replace(/^-g\s+/, "");
    if (pkg && !pkg.startsWith("-")) add("npm", m[0], pkg);
  }

  for (const m of document.matchAll(NPM_BACKTICK_RE)) {
    const candidate = m[1];
    if (
      candidate.includes("-") ||
      candidate.includes("/") ||
      candidate.includes("@")
    ) {
      add("npm", m[0], candidate.replace(/@.*$/, ""));
    }
  }

  for (const m of document.matchAll(STAT_RE)) {
    add("statistical", m[0], m[0].toLowerCase().trim());
  }

  return claims;
}
