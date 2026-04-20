import { describe, expect, it } from "vitest";
import { classify } from "../src/classifier.js";
import type { PackageUpdate, RegistryMetadata, SecurityAdvisory } from "../src/types.js";

const baseUpdate = (overrides: Partial<PackageUpdate> = {}): PackageUpdate => ({
  name: "test-package",
  current: "1.0.0",
  latest: "1.0.1",
  wanted: "1.0.1",
  kind: "prod",
  semverChange: "patch",
  ...overrides,
});

const baseMetadata = (overrides: Partial<RegistryMetadata> = {}): RegistryMetadata => ({
  weeklyDownloads: 100_000,
  daysSinceRelease: 30,
  maintainerCount: 2,
  hasBreakingKeyword: false,
  releaseNotes: null,
  repositoryUrl: null,
  ...overrides,
});

describe("classify", () => {
  it("classifies patch updates as safe", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "patch" }),
      metadata: baseMetadata(),
      advisories: [],
    });
    expect(result.risk).toBe("safe");
  });

  it("classifies minor updates as review", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "minor", latest: "1.1.0" }),
      metadata: baseMetadata(),
      advisories: [],
    });
    expect(result.risk).toBe("review");
  });

  it("classifies major updates as manual", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "major", latest: "2.0.0" }),
      metadata: baseMetadata(),
      advisories: [],
    });
    expect(result.risk).toBe("manual");
  });

  it("always classifies packages with security advisories as manual", () => {
    const advisory: SecurityAdvisory = {
      id: "GHSA-xxxx",
      severity: "moderate",
      title: "Test vulnerability",
      url: "https://github.com/advisories/GHSA-xxxx",
      range: "<1.0.1",
    };
    const result = classify({
      update: baseUpdate({ semverChange: "patch" }),
      metadata: baseMetadata(),
      advisories: [advisory],
    });
    expect(result.risk).toBe("manual");
    expect(result.reasons[0]).toContain("security advisory");
  });

  it("lowers risk for dev dependencies", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "minor", kind: "dev", latest: "1.1.0" }),
      metadata: baseMetadata(),
      advisories: [],
    });
    expect(result.risk).toBe("safe");
    expect(result.reasons).toContain("dev dependency (lower risk)");
  });

  it("raises risk when breaking keyword found in release notes", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "minor", latest: "1.1.0" }),
      metadata: baseMetadata({ hasBreakingKeyword: true }),
      advisories: [],
    });
    expect(result.risk).toBe("manual");
    expect(result.reasons).toContain("breaking change keyword found in release notes");
  });

  it("lowers risk for highly popular packages", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "minor", latest: "1.1.0" }),
      metadata: baseMetadata({ weeklyDownloads: 5_000_000 }),
      advisories: [],
    });
    expect(result.reasons).toContain("highly popular package (>1M weekly downloads)");
  });

  it("raises risk for very recent releases", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "minor", latest: "1.1.0" }),
      metadata: baseMetadata({ daysSinceRelease: 2 }),
      advisories: [],
    });
    expect(result.reasons).toContain("very recent release (<7 days old)");
  });

  it("handles missing metadata gracefully", () => {
    const result = classify({
      update: baseUpdate({ semverChange: "patch" }),
      metadata: null,
      advisories: [],
    });
    expect(result.risk).toBe("safe");
  });
});
