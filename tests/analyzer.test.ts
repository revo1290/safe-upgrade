import { describe, expect, it } from "vitest";

// Tests for pure utility functions extracted from analyzer logic

function resolveDependencyKind(
  name: string,
  packageJson: Record<string, unknown>,
): "prod" | "dev" | "peer" | "optional" {
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

import semver from "semver";

function getSemverChange(current: string, latest: string): "patch" | "minor" | "major" | "unknown" {
  const c = semver.valid(semver.coerce(current));
  const l = semver.valid(semver.coerce(latest));
  if (!c || !l) return "unknown";
  if (semver.major(l) !== semver.major(c)) return "major";
  if (semver.minor(l) !== semver.minor(c)) return "minor";
  return "patch";
}

describe("resolveDependencyKind", () => {
  it("returns prod for production dependency", () => {
    expect(resolveDependencyKind("lodash", { dependencies: { lodash: "^4.0.0" } })).toBe("prod");
  });

  it("returns dev for devDependency", () => {
    expect(resolveDependencyKind("vitest", { devDependencies: { vitest: "^1.0.0" } })).toBe("dev");
  });

  it("returns peer for peerDependency", () => {
    expect(resolveDependencyKind("react", { peerDependencies: { react: "^18.0.0" } })).toBe("peer");
  });

  it("does not false-negative on falsy version string '0'", () => {
    expect(resolveDependencyKind("pkg", { dependencies: { pkg: "0" } })).toBe("prod");
  });

  it("returns prod as fallback for unknown packages", () => {
    expect(resolveDependencyKind("unknown", {})).toBe("prod");
  });
});

describe("getSemverChange", () => {
  it("detects patch change", () => {
    expect(getSemverChange("1.0.0", "1.0.1")).toBe("patch");
  });

  it("detects minor change", () => {
    expect(getSemverChange("1.0.0", "1.1.0")).toBe("minor");
  });

  it("detects major change", () => {
    expect(getSemverChange("1.0.0", "2.0.0")).toBe("major");
  });

  it("returns unknown for non-semver versions", () => {
    expect(getSemverChange("not-a-version", "2.0.0")).toBe("unknown");
  });

  it("handles versions with range prefixes", () => {
    expect(getSemverChange("^1.0.0", "^1.0.1")).toBe("patch");
  });
});
