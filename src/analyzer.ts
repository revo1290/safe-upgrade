import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";
import { classify } from "./classifier.js";
import { fetchRegistryMetadata, fetchSecurityAdvisories } from "./registry.js";
import type {
  AnalysisResult,
  DependencyKind,
  NpmOutdatedEntry,
  PackageUpdate,
  SafeUpgradeConfig,
} from "./types.js";

const CONCURRENCY = 5;

export async function analyze(cwd: string, config: SafeUpgradeConfig): Promise<AnalysisResult> {
  const packageJsonPath = resolve(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`No package.json found in ${cwd}`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;

  const outdated = getOutdated(cwd, config.registryUrl);
  const ignoreSet = new Set(config.ignore ?? []);

  const updates: PackageUpdate[] = [];
  const skipped: string[] = [];

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

  const analyzed = await processInBatches(updates, CONCURRENCY, async (update) => {
    const [metadata, advisories] = await Promise.all([
      fetchRegistryMetadata(update.name, update.latest, config.githubToken),
      fetchSecurityAdvisories(update.name),
    ]);
    return classify({ update, metadata, advisories });
  });

  const result: AnalysisResult = {
    safe: [],
    review: [],
    manual: [],
    skipped,
    totalCount: updates.length,
    analyzedAt: new Date(),
  };

  for (const pkg of analyzed) {
    result[pkg.risk].push(pkg);
  }

  return result;
}

function getOutdated(cwd: string, registryUrl?: string): Record<string, NpmOutdatedEntry> {
  const args = ["outdated", "--json"];
  if (registryUrl) args.push("--registry", registryUrl);
  try {
    const output = execFileSync("npm", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
      env: { ...process.env },
    });
    return JSON.parse(output.toString()) as Record<string, NpmOutdatedEntry>;
  } catch (err) {
    const error = err as { stdout?: Buffer };
    if (error.stdout && error.stdout.length > 0) {
      try {
        return JSON.parse(error.stdout.toString()) as Record<string, NpmOutdatedEntry>;
      } catch {
        return {};
      }
    }
    return {};
  }
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
