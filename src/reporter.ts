import chalk from "chalk";
import type { AnalysisResult, AnalyzedPackage } from "./types.js";

const LABEL = {
  safe: chalk.bgGreen.black(" SAFE "),
  review: chalk.bgYellow.black(" REVIEW "),
  manual: chalk.bgRed.white(" MANUAL "),
};

const ICON = {
  safe: chalk.green("●"),
  review: chalk.yellow("●"),
  manual: chalk.red("●"),
};

export function renderTerminal(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold("safe-upgrade") + chalk.dim(" — dependency risk classifier"));
  lines.push(
    chalk.dim(
      `Analyzed ${result.totalCount} outdated packages · ${result.analyzedAt.toLocaleString()}`,
    ),
  );
  lines.push("");

  if (result.totalCount === 0) {
    lines.push(chalk.green("✓ All dependencies are up to date!"));
    return lines.join("\n");
  }

  if (result.safe.length > 0) {
    const n = result.safe.length;
    lines.push(LABEL.safe + chalk.bold(` ${n} ${n === 1 ? "package" : "packages"} — apply safely`));
    for (const pkg of result.safe) {
      lines.push(renderPackageLine(pkg));
    }
    lines.push("");
  }

  if (result.review.length > 0) {
    const n = result.review.length;
    lines.push(
      LABEL.review + chalk.bold(` ${n} ${n === 1 ? "package" : "packages"} — check changelog`),
    );
    for (const pkg of result.review) {
      lines.push(renderPackageLine(pkg));
    }
    lines.push("");
  }

  if (result.manual.length > 0) {
    const n = result.manual.length;
    lines.push(
      LABEL.manual +
        chalk.bold(` ${n} ${n === 1 ? "package" : "packages"} — manual review required`),
    );
    for (const pkg of result.manual) {
      lines.push(renderPackageLine(pkg));
    }
    lines.push("");
  }

  if (result.skipped.length > 0) {
    lines.push(chalk.dim(`Ignored: ${result.skipped.join(", ")}`));
    lines.push("");
  }

  lines.push(renderSummary(result));

  return lines.join("\n");
}

function renderPackageLine(pkg: AnalyzedPackage): string {
  const { update, reasons, advisories } = pkg;
  const icon = ICON[pkg.risk];
  const name = chalk.cyan(update.name.padEnd(40));
  const version = `${chalk.dim(update.current)} → ${chalk.white(update.latest)}`;
  const badge = update.kind === "dev" ? chalk.dim(" [dev]") : "";
  const securityBadge =
    advisories.length > 0 ? chalk.red(` ⚠ security(${advisories[0]?.severity ?? ""})`) : "";
  const reasonText = chalk.dim(` · ${reasons[0] ?? ""}`);

  return `  ${icon} ${name} ${version}${badge}${securityBadge}${reasonText}`;
}

function renderSummary(result: AnalysisResult): string {
  const parts: string[] = [];
  if (result.safe.length > 0) parts.push(chalk.green(`${result.safe.length} safe`));
  if (result.review.length > 0) parts.push(chalk.yellow(`${result.review.length} review`));
  if (result.manual.length > 0) parts.push(chalk.red(`${result.manual.length} manual`));

  const hints: string[] = [];
  if (result.safe.length > 0) hints.push(chalk.dim("  Run with --apply to update safe packages"));
  if (result.review.length > 0 || result.manual.length > 0) {
    hints.push(chalk.dim("  Run with --json for machine-readable output"));
  }

  return [chalk.bold("Summary: ") + parts.join(chalk.dim(" · ")), ...hints].join("\n");
}

export function renderJson(result: AnalysisResult): string {
  return JSON.stringify(
    {
      analyzedAt: result.analyzedAt.toISOString(),
      totalCount: result.totalCount,
      summary: {
        safe: result.safe.length,
        review: result.review.length,
        manual: result.manual.length,
        skipped: result.skipped.length,
      },
      packages: {
        safe: result.safe.map(serializePackage),
        review: result.review.map(serializePackage),
        manual: result.manual.map(serializePackage),
      },
      skipped: result.skipped,
    },
    null,
    2,
  );
}

function serializePackage(pkg: AnalyzedPackage) {
  return {
    name: pkg.update.name,
    current: pkg.update.current,
    latest: pkg.update.latest,
    kind: pkg.update.kind,
    semverChange: pkg.update.semverChange,
    risk: pkg.risk,
    reasons: pkg.reasons,
    advisories: pkg.advisories,
    metadata: pkg.metadata
      ? {
          weeklyDownloads: pkg.metadata.weeklyDownloads,
          daysSinceRelease: pkg.metadata.daysSinceRelease,
          hasBreakingKeyword: pkg.metadata.hasBreakingKeyword,
        }
      : null,
  };
}
