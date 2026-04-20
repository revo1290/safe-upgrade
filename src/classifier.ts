import type {
  AnalyzedPackage,
  PackageUpdate,
  RegistryMetadata,
  RiskLevel,
  SecurityAdvisory,
} from "./types.js";

export interface ClassificationContext {
  update: PackageUpdate;
  metadata: RegistryMetadata | null;
  advisories: SecurityAdvisory[];
}

export function classify(ctx: ClassificationContext): AnalyzedPackage {
  const { update, metadata, advisories } = ctx;
  const reasons: string[] = [];

  if (advisories.length > 0) {
    const worst = advisories.reduce<SecurityAdvisory["severity"]>((acc, adv) => {
      return severityRank(adv.severity) > severityRank(acc) ? adv.severity : acc;
    }, "info");
    reasons.push(`security advisory (${worst}): ${advisories[0]?.title ?? ""}`);
    return { update, risk: "manual", reasons, metadata, advisories };
  }

  let score = baseScore(update.semverChange);

  if (update.kind === "dev") {
    score -= 25;
    reasons.push("dev dependency (lower risk)");
  }

  if (update.semverChange === "patch") {
    reasons.push("patch update");
  } else if (update.semverChange === "minor") {
    reasons.push("minor update");
  } else if (update.semverChange === "major") {
    reasons.push("major update");
  }

  if (metadata) {
    if (metadata.hasBreakingKeyword) {
      score += 30;
      reasons.push("breaking change keyword found in release notes");
    }

    if (metadata.weeklyDownloads > 1_000_000) {
      score -= 10;
      reasons.push("highly popular package (>1M weekly downloads)");
    }

    if (metadata.daysSinceRelease < 7) {
      score += 15;
      reasons.push("very recent release (<7 days old)");
    } else if (metadata.daysSinceRelease > 180) {
      score -= 5;
      reasons.push("stable release (>6 months old)");
    }
  }

  const risk = scoreToRisk(score);
  return { update, risk, reasons, metadata, advisories };
}

function baseScore(semverChange: PackageUpdate["semverChange"]): number {
  switch (semverChange) {
    case "patch":
      return 10;
    case "minor":
      return 50;
    case "major":
      return 85;
    default:
      return 70;
  }
}

function scoreToRisk(score: number): RiskLevel {
  if (score < 30) return "safe";
  if (score < 70) return "review";
  return "manual";
}

function severityRank(severity: SecurityAdvisory["severity"]): number {
  const ranks: Record<SecurityAdvisory["severity"], number> = {
    info: 0,
    low: 1,
    moderate: 2,
    high: 3,
    critical: 4,
  };
  return ranks[severity];
}
