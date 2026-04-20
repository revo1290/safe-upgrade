import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { RegistryMetadata, SecurityAdvisory } from "./types.js";

const REGISTRY_BASE = "https://registry.npmjs.org";
const DOWNLOADS_API = "https://api.npmjs.org/downloads/point/last-week";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

const require = createRequire(import.meta.url);
const pkgVersion: string = (require("../package.json") as { version: string }).version;
const USER_AGENT = `safe-upgrade/${pkgVersion} (https://github.com/revo1290/safe-upgrade)`;

const BREAKING_KEYWORDS = [
  "breaking change",
  "breaking:",
  "breaking ",
  "incompatible",
  "removed api",
  "dropped support",
  "no longer supported",
];

function sanitizePackageName(name: string): string {
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    throw new Error(`Invalid package name: ${name}`);
  }
  return name;
}

function encodePackageName(name: string): string {
  return name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status !== 429 && res.status < 500) return res;

    if (attempt < retries) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter ? Number(retryAfter) * 1000 : Math.min(500 * 2 ** attempt, 4_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

export async function fetchRegistryMetadata(
  packageName: string,
  version: string,
  githubToken?: string,
): Promise<RegistryMetadata | null> {
  try {
    const safeName = sanitizePackageName(packageName);
    const encodedName = encodePackageName(safeName);
    const headers = { Accept: "application/json", "User-Agent": USER_AGENT };

    const [registryData, downloadsData] = await Promise.allSettled([
      fetchWithRetry(`${REGISTRY_BASE}/${encodedName}`, { headers }).then((r) => {
        if (!r.ok) throw new Error(`Registry returned ${r.status}`);
        return r.json();
      }),
      fetchWithRetry(`${DOWNLOADS_API}/${encodedName}`, { headers }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ]);

    if (registryData.status === "rejected") return null;

    const registry = registryData.value as Record<string, unknown>;
    const timeData = registry.time as Record<string, string> | undefined;
    const releaseTime = timeData?.[version];
    const daysSinceRelease = releaseTime
      ? Math.floor((Date.now() - new Date(releaseTime).getTime()) / 86_400_000)
      : 999;

    const maintainers = registry.maintainers as unknown[] | undefined;
    const maintainerCount = Array.isArray(maintainers) ? maintainers.length : 1;

    const weeklyDownloads =
      downloadsData.status === "fulfilled" && downloadsData.value != null
        ? (((downloadsData.value as Record<string, unknown>).downloads as number) ?? 0)
        : 0;

    const repositoryUrl = extractRepositoryUrl(registry);
    const releaseNotes = await fetchReleaseNotes(repositoryUrl, version, githubToken);
    const hasBreakingKeyword = detectBreakingChanges(releaseNotes ?? "");

    return {
      weeklyDownloads,
      daysSinceRelease,
      maintainerCount,
      hasBreakingKeyword,
      releaseNotes,
      repositoryUrl,
    };
  } catch {
    return null;
  }
}

function extractRepositoryUrl(registry: Record<string, unknown>): string | null {
  const repo = registry.repository;
  if (!repo) return null;
  if (typeof repo === "string") return normalizeGitHubUrl(repo);
  if (typeof repo === "object" && repo !== null) {
    const url = (repo as Record<string, unknown>).url;
    if (typeof url === "string") return normalizeGitHubUrl(url);
  }
  return null;
}

export function normalizeGitHubUrl(url: string): string | null {
  const match = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?(?:\s|$)/);
  if (!match || !match[1]) return null;
  return `https://github.com/${match[1]}`;
}

async function fetchReleaseNotes(
  repoUrl: string | null,
  version: string,
  githubToken?: string,
): Promise<string | null> {
  if (!repoUrl) return null;

  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match || !match[1]) return null;

  const repo = match[1];
  const tags = [`v${version}`, version];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };

  for (const tag of tags) {
    try {
      const res = await fetchWithRetry(
        `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
        { headers },
        1,
      );
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return typeof data.body === "string" ? data.body : null;
      }
      if (res.status === 404) continue;
    } catch {
      // try next tag
    }
  }

  return null;
}

export function detectBreakingChanges(text: string): boolean {
  const lower = text.toLowerCase();
  return BREAKING_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export async function fetchSecurityAdvisories(packageName: string): Promise<SecurityAdvisory[]> {
  try {
    const safeName = sanitizePackageName(packageName);
    const res = await fetchWithRetry(
      "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({ [safeName]: ["*"] }),
      },
      1,
    );

    if (!res.ok) return [];

    const data = (await res.json()) as Record<string, unknown[]>;
    const advisories = data[safeName] ?? [];

    return advisories.map((adv) => {
      const a = adv as Record<string, unknown>;
      return {
        id: String(a.id ?? ""),
        severity: (a.severity as SecurityAdvisory["severity"]) ?? "info",
        title: String(a.title ?? ""),
        url: String(a.url ?? ""),
        range: String(a.vulnerable_versions ?? "*"),
      };
    });
  } catch {
    return [];
  }
}
