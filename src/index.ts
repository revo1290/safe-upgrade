export { analyze } from "./analyzer.js";
export { classify } from "./classifier.js";
export { loadConfig } from "./config.js";
export { detectPackageManager, getPackageManagerCommands } from "./packageManager.js";
export { renderJson, renderTerminal } from "./reporter.js";
export type {
  AnalysisResult,
  AnalyzedPackage,
  DependencyKind,
  PackageUpdate,
  RegistryMetadata,
  RiskLevel,
  SafeUpgradeConfig,
  SecurityAdvisory,
} from "./types.js";
