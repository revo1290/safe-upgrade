export type RiskLevel = "safe" | "review" | "manual";

export type DependencyKind = "prod" | "dev" | "peer" | "optional";

export interface PackageUpdate {
  name: string;
  current: string;
  latest: string;
  wanted: string;
  kind: DependencyKind;
  semverChange: "patch" | "minor" | "major" | "unknown";
}

export interface RegistryMetadata {
  weeklyDownloads: number;
  daysSinceRelease: number;
  maintainerCount: number;
  hasBreakingKeyword: boolean;
  deprecated: string | null;
  releaseNotes: string | null;
  repositoryUrl: string | null;
}

export interface SecurityAdvisory {
  id: string;
  severity: "info" | "low" | "moderate" | "high" | "critical";
  title: string;
  url: string;
  range: string;
}

export interface AnalyzedPackage {
  update: PackageUpdate;
  risk: RiskLevel;
  reasons: string[];
  metadata: RegistryMetadata | null;
  advisories: SecurityAdvisory[];
}

export interface AnalysisResult {
  safe: AnalyzedPackage[];
  review: AnalyzedPackage[];
  manual: AnalyzedPackage[];
  skipped: string[];
  excludedDevCount: number;
  totalCount: number;
  analyzedAt: Date;
  packageManager: string;
}

export interface SafeUpgradeConfig {
  ignore?: string[];
  githubToken?: string;
  registryUrl?: string;
  includeDevDependencies?: boolean;
  filter?: RiskLevel[];
  jsonOutput?: boolean;
  apply?: boolean;
  dryRun?: boolean;
}

export interface NpmOutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
  dependent: string;
  location?: string;
}
