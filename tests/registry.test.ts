import { describe, expect, it } from "vitest";
import { detectBreakingChanges, normalizeGitHubUrl } from "../src/registry.js";

function sanitizePackageName(name: string): string {
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    throw new Error(`Invalid package name: ${name}`);
  }
  return name;
}

describe("sanitizePackageName", () => {
  it("accepts valid package names", () => {
    expect(() => sanitizePackageName("lodash")).not.toThrow();
    expect(() => sanitizePackageName("@types/node")).not.toThrow();
    expect(() => sanitizePackageName("react-dom")).not.toThrow();
    expect(() => sanitizePackageName("@scope/pkg")).not.toThrow();
  });

  it("rejects names with shell special characters", () => {
    expect(() => sanitizePackageName("pkg; rm -rf /")).toThrow("Invalid package name");
    expect(() => sanitizePackageName("pkg && evil")).toThrow("Invalid package name");
    expect(() => sanitizePackageName("../relative")).toThrow("Invalid package name");
    expect(() => sanitizePackageName("pkg`whoami`")).toThrow("Invalid package name");
  });

  it("rejects uppercase names", () => {
    expect(() => sanitizePackageName("MyPackage")).toThrow("Invalid package name");
  });
});

describe("normalizeGitHubUrl", () => {
  it("handles HTTPS GitHub URLs", () => {
    expect(normalizeGitHubUrl("https://github.com/user/repo")).toBe("https://github.com/user/repo");
  });

  it("strips .git suffix", () => {
    expect(normalizeGitHubUrl("https://github.com/user/repo.git")).toBe(
      "https://github.com/user/repo",
    );
  });

  it("handles git+ssh URLs", () => {
    expect(normalizeGitHubUrl("git+ssh://git@github.com/user/repo.git")).toBe(
      "https://github.com/user/repo",
    );
  });

  it("returns null for non-GitHub URLs", () => {
    expect(normalizeGitHubUrl("https://gitlab.com/user/repo")).toBeNull();
  });
});

describe("detectBreakingChanges", () => {
  it("detects 'breaking change' keyword", () => {
    expect(detectBreakingChanges("This release has a breaking change in the API")).toBe(true);
  });

  it("detects 'BREAKING' keyword case-insensitively", () => {
    expect(detectBreakingChanges("BREAKING: removed old method")).toBe(true);
  });

  it("detects 'dropped support'", () => {
    expect(detectBreakingChanges("We dropped support for Node 16")).toBe(true);
  });

  it("returns false for safe release notes", () => {
    expect(detectBreakingChanges("Added new feature, fixed bug #123")).toBe(false);
  });

  it("handles empty string", () => {
    expect(detectBreakingChanges("")).toBe(false);
  });
});
