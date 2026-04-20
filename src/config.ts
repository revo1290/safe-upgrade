import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SafeUpgradeConfig } from "./types.js";

const RC_FILENAME = ".safe-upgrade.json";
const PKG_KEY = "safe-upgrade";

const VALID_KEYS: ReadonlySet<string> = new Set([
  "ignore",
  "githubToken",
  "registryUrl",
  "includeDevDependencies",
]);

export function loadConfig(cwd: string): Partial<SafeUpgradeConfig> {
  const fromRc = tryLoadRc(resolve(cwd, RC_FILENAME));
  if (fromRc) return sanitize(fromRc);

  const fromPkg = tryLoadFromPackageJson(resolve(cwd, "package.json"));
  if (fromPkg) return sanitize(fromPkg);

  return {};
}

function tryLoadRc(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tryLoadFromPackageJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const section = pkg[PKG_KEY];
    if (typeof section !== "object" || section === null || Array.isArray(section)) return null;
    return section as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitize(raw: Record<string, unknown>): Partial<SafeUpgradeConfig> {
  const result: Partial<SafeUpgradeConfig> = {};

  for (const key of Object.keys(raw)) {
    if (!VALID_KEYS.has(key)) continue;

    const value = raw[key];

    if (key === "ignore") {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        result.ignore = value as string[];
      }
    } else if (key === "githubToken") {
      if (typeof value === "string" && value.length > 0) {
        result.githubToken = value;
      }
    } else if (key === "registryUrl") {
      if (typeof value === "string" && isValidUrl(value)) {
        result.registryUrl = value;
      }
    } else if (key === "includeDevDependencies") {
      if (typeof value === "boolean") {
        result.includeDevDependencies = value;
      }
    }
  }

  return result;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
