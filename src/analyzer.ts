import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";
import { classify } from "./classifier.js";
import { detectPackageManager, getPackageManagerCommands } from "./packageManager.js";
import { fetchRegistryMetadata, fetchSecurityAdvisories } from "./registry.js";
import type {
  AnalysisResult,
  DependencyKind,
  NpmOutdatedEntry,
  PackageUpdate,
  SafeUpgradeConfig,
} from "./types.js";

const CONCURRENCY = 5;

export type ProgressCallback = (done: number, total: number) => void;

export async function analyze(
  cwd: string,
  config: SafeUpgradeConfig,
  onProgress?: ProgressCallback,
): Promise<AnalysisResult> {
  const packageJsonPath = resolve(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`No package.json found in ${cwd}`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;
  const pm = detectPackageManager(cwd);
  const pmCommands = getPackageManagerCommands(pm, config.registryUrl);

  if (!pmCommands.supported) {
    throw new Error(
      `${pm} does not support JSON-formatted outdated output yet. ` +
        `Run \`npm outdated\` or \`pnpm outdated\` instead, or set packageManager to npm/pnpm.`,
    );
  }

  const outdated = getOutdated(cwd, pmCommands.cmd, pmCommands.args, pm);
  const ignoreSet = new Set(config.ignore ?? []);

  const updates: PackageUpdate[] = [];
  const skipped: string[] = [];
  let excludedDevCount = 0;

  for (const [name, entry] of Object.entries(outdated)) {
    if (ignoreSet.has(name)) {
      skipped.push(name);
      continue;
    }

    if (entry.current === "MISSING" || !semver.valid(semver.coerce(entry.current))) {
      continue;
    }

    const kind = resolveDependencyKind(name, packageJson);

    if (!config.includeDevDependencies && kind === "dev") {
      excludedDevCount++;
      continue;
    }

    const semverChange = getSemverChange(entry.current, entry.latest);
    updates.push({
      name,
      current: entry.current,
      latest: entry.latest,
      wanted: entry.wanted,
      kind,
      semverChange,
    });
  }

  let done = 0;
  const analyzed = await processInBatches(updates, CONCURRENCY, async (update) => {
    const [metadata, advisories] = await Promise.all([
      fetchRegistryMetadata(update.name, update.latest, config.githubToken),
      fetchSecurityAdvisories(update.name),
    ]);
    done++;
    onProgress?.(done, updates.length);
    return classify({ update, metadata, advisories });
  });

  const result: AnalysisResult = {
    safe: [],
    review: [],
    manual: [],
    skipped,
    excludedDevCount,
    totalCount: updates.length,
    analyzedAt: new Date(),
    packageManager: pm,
  };

  for (const pkg of analyzed) {
    result[pkg.risk].push(pkg);
  }

  return result;
}

function getOutdated(
  cwd: string,
  cmd: string,
  args: string[],
  pm: string,
): Record<string, NpmOutdatedEntry> {
  try {
    const output = execFileSync(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
      env: { ...process.env },
    });
    return parseOutdatedOutput(output.toString(), pm);
  } catch (err) {
    const error = err as { stdout?: Buffer };
    if (error.stdout && error.stdout.length > 0) {
      try {
        return parseOutdatedOutput(error.stdout.toString(), pm);
      } catch {
        return {};
      }
    }
    return {};
  }
}

function parseOutdatedOutput(raw: string, pm: string): Record<string, NpmOutdatedEntry> {
  const data = JSON.parse(raw) as unknown;

  if (pm === "yarn" && Array.isArray(data)) {
    return parseYarnOutdated(data);
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    if ("dependencies" in obj || "devDependencies" in obj) {
      return parsePnpmOutdated(obj);
    }

    return data as Record<string, NpmOutdatedEntry>;
  }

  return {};
}

function parsePnpmOutdated(data: Record<string, unknown>): Record<string, NpmOutdatedEntry> {
  const result: Record<string, NpmOutdatedEntry> = {};
  const sections = ["dependencies", "devDependencies", "optionalDependencies"] as const;

  for (const section of sections) {
    const sectionData = data[section];
    if (typeof sectionData !== "object" || sectionData === null) continue;

    for (const [name, entry] of Object.entries(sectionData as Record<string, unknown>)) {
      const e = entry as Record<string, string>;
      if (e.current && e.latest) {
        result[name] = {
          current: e.current,
          wanted: e.wanted ?? e.latest,
          latest: e.latest,
          dependent: name,
        };
      }
    }
  }

  return result;
}

function parseYarnOutdated(lines: unknown[]): Record<string, NpmOutdatedEntry> {
  const result: Record<string, NpmOutdatedEntry> = {};

  for (const line of lines) {
    if (typeof line !== "object" || line === null) continue;
    const l = line as Record<string, unknown>;
    if (l.type !== "table") continue;

    const tableData = l.data as { body?: unknown[][] } | undefined;
    for (const row of tableData?.body ?? []) {
      if (!Array.isArray(row) || row.length < 4) continue;
      const [name, current, wanted, latest] = row as string[];
      if (name && current && latest) {
        result[name] = { current, wanted: wanted ?? latest, latest, dependent: name };
      }
    }
  }

  return result;
}

function resolveDependencyKind(name: string, packageJson: Record<string, unknown>): DependencyKind {
  const deps = packageJson.dependencies as Record<string, string> | undefined;
  const devDeps = packageJson.devDependencies as Record<string, string> | undefined;
  const peerDeps = packageJson.peerDependencies as Record<string, string> | undefined;
  const optDeps = packageJson.optionalDependencies as Record<string, string> | undefined;

  if (deps !== undefined && name in deps) return "prod";
  if (devDeps !== undefined && name in devDeps) return "dev";
  if (peerDeps !== undefined && name in peerDeps) return "peer";
  if (optDeps !== undefined && name in optDeps) return "optional";
  return "prod";
}

function getSemverChange(current: string, latest: string): PackageUpdate["semverChange"] {
  const c = semver.valid(semver.coerce(current));
  const l = semver.valid(semver.coerce(latest));
  if (!c || !l) return "unknown";
  if (semver.major(l) !== semver.major(c)) return "major";
  if (semver.minor(l) !== semver.minor(c)) return "minor";
  return "patch";
}

async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      }
    }
  }
  return results;
}
