import { describe, expect, it } from "vitest";
import { renderJson, renderTerminal } from "../src/reporter.js";
import type { AnalysisResult, AnalyzedPackage } from "../src/types.js";

function makePackage(overrides: Partial<AnalyzedPackage> = {}): AnalyzedPackage {
  return {
    update: {
      name: "test-pkg",
      current: "1.0.0",
      latest: "1.0.1",
      wanted: "1.0.1",
      kind: "prod",
      semverChange: "patch",
    },
    risk: "safe",
    reasons: ["patch update"],
    metadata: null,
    advisories: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    safe: [],
    review: [],
    manual: [],
    skipped: [],
    excludedDevCount: 0,
    totalCount: 0,
    analyzedAt: new Date("2024-01-01T00:00:00Z"),
    packageManager: "npm",
    ...overrides,
  };
}

describe("renderTerminal", () => {
  it("shows all up-to-date message when no packages outdated", () => {
    const output = renderTerminal(makeResult({ totalCount: 0 }));
    expect(output).toContain("All dependencies are up to date");
  });

  it("shows excluded dev count hint when no packages outdated", () => {
    const output = renderTerminal(makeResult({ totalCount: 0, excludedDevCount: 3 }));
    expect(output).toContain("3 dev dependencies not checked");
    expect(output).toContain("--include-dev");
  });

  it("renders safe packages section", () => {
    const pkg = makePackage({ risk: "safe" });
    const output = renderTerminal(makeResult({ safe: [pkg], totalCount: 1 }));
    expect(output).toContain("SAFE");
    expect(output).toContain("test-pkg");
    expect(output).toContain("1.0.0");
    expect(output).toContain("1.0.1");
  });

  it("renders review packages section", () => {
    const pkg = makePackage({ risk: "review", reasons: ["minor update"] });
    const output = renderTerminal(makeResult({ review: [pkg], totalCount: 1 }));
    expect(output).toContain("REVIEW");
    expect(output).toContain("test-pkg");
  });

  it("renders manual packages section", () => {
    const pkg = makePackage({ risk: "manual", reasons: ["major update"] });
    const output = renderTerminal(makeResult({ manual: [pkg], totalCount: 1 }));
    expect(output).toContain("MANUAL");
    expect(output).toContain("test-pkg");
  });

  it("renders skipped packages", () => {
    const pkg = makePackage({ risk: "safe" });
    const output = renderTerminal(
      makeResult({ safe: [pkg], skipped: ["lodash", "react"], totalCount: 1 }),
    );
    expect(output).toContain("lodash");
    expect(output).toContain("react");
  });

  it("shows --include-dev hint when dev packages excluded", () => {
    const pkg = makePackage({ risk: "safe" });
    const output = renderTerminal(makeResult({ safe: [pkg], totalCount: 1, excludedDevCount: 2 }));
    expect(output).toContain("2 dev dependencies not analyzed");
    expect(output).toContain("--include-dev");
  });

  it("shows summary with counts", () => {
    const safe = makePackage({ risk: "safe" });
    const review = makePackage({
      risk: "review",
      update: { ...makePackage().update, name: "pkg2" },
    });
    const output = renderTerminal(makeResult({ safe: [safe], review: [review], totalCount: 2 }));
    expect(output).toContain("Summary");
    expect(output).toContain("1 safe");
    expect(output).toContain("1 review");
  });

  it("shows --apply hint when safe packages exist", () => {
    const pkg = makePackage({ risk: "safe" });
    const output = renderTerminal(makeResult({ safe: [pkg], totalCount: 1 }));
    expect(output).toContain("--apply");
  });

  it("shows [dev] badge for dev dependencies", () => {
    const pkg = makePackage({ update: { ...makePackage().update, kind: "dev" } });
    const output = renderTerminal(makeResult({ safe: [pkg], totalCount: 1 }));
    expect(output).toContain("[dev]");
  });

  it("shows security badge when advisories present", () => {
    const pkg = makePackage({
      risk: "manual",
      advisories: [
        { id: "1", severity: "high", title: "vuln", url: "https://example.com", range: "*" },
      ],
    });
    const output = renderTerminal(makeResult({ manual: [pkg], totalCount: 1 }));
    expect(output).toContain("security");
    expect(output).toContain("high");
  });

  it("shows [deprecated] badge for deprecated packages", () => {
    const pkg = makePackage({
      risk: "manual",
      metadata: {
        weeklyDownloads: 0,
        daysSinceRelease: 10,
        maintainerCount: 1,
        hasBreakingKeyword: false,
        deprecated: "Use new-pkg instead",
        releaseNotes: null,
        repositoryUrl: null,
      },
    });
    const output = renderTerminal(makeResult({ manual: [pkg], totalCount: 1 }));
    expect(output).toContain("[deprecated]");
  });
});

describe("renderJson", () => {
  it("produces valid JSON", () => {
    const result = makeResult({ totalCount: 0 });
    expect(() => JSON.parse(renderJson(result))).not.toThrow();
  });

  it("includes top-level fields", () => {
    const result = makeResult({ totalCount: 0, packageManager: "pnpm" });
    const json = JSON.parse(renderJson(result));
    expect(json.packageManager).toBe("pnpm");
    expect(json.totalCount).toBe(0);
    expect(typeof json.analyzedAt).toBe("string");
  });

  it("serializes packages into safe/review/manual buckets", () => {
    const safe = makePackage({ risk: "safe" });
    const manual = makePackage({ risk: "manual", reasons: ["major update"] });
    const result = makeResult({ safe: [safe], manual: [manual], totalCount: 2 });
    const json = JSON.parse(renderJson(result));
    expect(json.packages.safe).toHaveLength(1);
    expect(json.packages.manual).toHaveLength(1);
    expect(json.packages.review).toHaveLength(0);
  });

  it("includes summary counts", () => {
    const safe = makePackage({ risk: "safe" });
    const result = makeResult({ safe: [safe], totalCount: 1, excludedDevCount: 2, skipped: ["x"] });
    const json = JSON.parse(renderJson(result));
    expect(json.summary.safe).toBe(1);
    expect(json.summary.excludedDev).toBe(2);
    expect(json.summary.skipped).toBe(1);
  });

  it("serializes package fields correctly", () => {
    const pkg = makePackage({
      risk: "safe",
      reasons: ["patch update"],
      metadata: {
        weeklyDownloads: 500_000,
        daysSinceRelease: 30,
        maintainerCount: 2,
        hasBreakingKeyword: false,
        deprecated: null,
        releaseNotes: null,
        repositoryUrl: null,
      },
    });
    const result = makeResult({ safe: [pkg], totalCount: 1 });
    const json = JSON.parse(renderJson(result));
    const serialized = json.packages.safe[0];
    expect(serialized.name).toBe("test-pkg");
    expect(serialized.current).toBe("1.0.0");
    expect(serialized.latest).toBe("1.0.1");
    expect(serialized.semverChange).toBe("patch");
    expect(serialized.risk).toBe("safe");
    expect(serialized.reasons).toContain("patch update");
    expect(serialized.metadata.weeklyDownloads).toBe(500_000);
  });

  it("handles null metadata gracefully", () => {
    const pkg = makePackage({ metadata: null });
    const result = makeResult({ safe: [pkg], totalCount: 1 });
    const json = JSON.parse(renderJson(result));
    expect(json.packages.safe[0].metadata).toBeNull();
    expect(json.packages.safe[0].deprecated).toBeNull();
  });

  it("includes skipped array", () => {
    const result = makeResult({ skipped: ["ignored-pkg"], totalCount: 0 });
    const json = JSON.parse(renderJson(result));
    expect(json.skipped).toContain("ignored-pkg");
  });
});
