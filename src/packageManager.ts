import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

const LOCKFILE_MAP: Array<{ file: string; pm: PackageManager }> = [
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

export function detectPackageManager(cwd: string): PackageManager {
  const pkg = tryReadPackageJson(cwd);
  if (pkg) {
    const declared = extractDeclaredPm(pkg);
    if (declared) return declared;
  }

  for (const { file, pm } of LOCKFILE_MAP) {
    if (existsSync(resolve(cwd, file))) return pm;
  }

  return "npm";
}

function tryReadPackageJson(cwd: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(resolve(cwd, "package.json"), "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractDeclaredPm(pkg: Record<string, unknown>): PackageManager | null {
  const pm = pkg.packageManager;
  if (typeof pm !== "string") return null;
  if (pm.startsWith("pnpm")) return "pnpm";
  if (pm.startsWith("yarn")) return "yarn";
  if (pm.startsWith("bun")) return "bun";
  if (pm.startsWith("npm")) return "npm";
  return null;
}

export interface OutdatedCommandResult {
  cmd: string;
  args: string[];
  supported: boolean;
  installCmd: string;
  installArgs: (packages: string[]) => string[];
}

export function getPackageManagerCommands(
  pm: PackageManager,
  registryUrl?: string,
): OutdatedCommandResult {
  const registrySuffix = registryUrl ? ["--registry", registryUrl] : [];

  switch (pm) {
    case "pnpm":
      return {
        cmd: "pnpm",
        args: ["outdated", "--json", ...registrySuffix],
        supported: true,
        installCmd: "pnpm",
        installArgs: (pkgs) => ["add", ...pkgs],
      };
    case "yarn":
      return {
        cmd: "yarn",
        args: ["outdated", "--json", ...registrySuffix],
        supported: true,
        installCmd: "yarn",
        installArgs: (pkgs) => ["add", ...pkgs],
      };
    case "bun":
      return {
        cmd: "bun",
        args: ["outdated"],
        supported: false,
        installCmd: "bun",
        installArgs: (pkgs) => ["add", ...pkgs],
      };
    default:
      return {
        cmd: "npm",
        args: ["outdated", "--json", ...registrySuffix],
        supported: true,
        installCmd: "npm",
        installArgs: (pkgs) => ["install", ...pkgs],
      };
  }
}
