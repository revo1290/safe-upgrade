import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPackageManager, getPackageManagerCommands } from "../src/packageManager.js";

let tmp: string;

beforeEach(() => {
  tmp = join(tmpdir(), `safe-upgrade-pm-test-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("detectPackageManager", () => {
  it("defaults to npm when no lockfile found", () => {
    expect(detectPackageManager(tmp)).toBe("npm");
  });

  it("detects npm from package-lock.json", () => {
    writeFileSync(join(tmp, "package-lock.json"), "{}");
    expect(detectPackageManager(tmp)).toBe("npm");
  });

  it("detects pnpm from pnpm-lock.yaml", () => {
    writeFileSync(join(tmp, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmp)).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", () => {
    writeFileSync(join(tmp, "yarn.lock"), "");
    expect(detectPackageManager(tmp)).toBe("yarn");
  });

  it("detects bun from bun.lockb", () => {
    writeFileSync(join(tmp, "bun.lockb"), "");
    expect(detectPackageManager(tmp)).toBe("bun");
  });

  it("prefers packageManager field in package.json over lockfile", () => {
    writeFileSync(join(tmp, "package-lock.json"), "{}");
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ packageManager: "pnpm@8.0.0" }));
    expect(detectPackageManager(tmp)).toBe("pnpm");
  });

  it("prefers bun lockfile over npm lockfile when both exist", () => {
    writeFileSync(join(tmp, "bun.lockb"), "");
    writeFileSync(join(tmp, "package-lock.json"), "{}");
    expect(detectPackageManager(tmp)).toBe("bun");
  });
});

describe("getPackageManagerCommands", () => {
  it("returns npm commands", () => {
    const cmds = getPackageManagerCommands("npm");
    expect(cmds.cmd).toBe("npm");
    expect(cmds.supported).toBe(true);
    expect(cmds.installArgs(["lodash@4.0.0"])).toEqual(["install", "lodash@4.0.0"]);
  });

  it("returns pnpm commands", () => {
    const cmds = getPackageManagerCommands("pnpm");
    expect(cmds.cmd).toBe("pnpm");
    expect(cmds.supported).toBe(true);
    expect(cmds.installArgs(["lodash@4.0.0"])).toEqual(["add", "lodash@4.0.0"]);
  });

  it("marks bun as unsupported", () => {
    const cmds = getPackageManagerCommands("bun");
    expect(cmds.supported).toBe(false);
  });

  it("includes registry flag when registryUrl provided", () => {
    const cmds = getPackageManagerCommands("npm", "https://my-registry.example.com");
    expect(cmds.args).toContain("--registry");
    expect(cmds.args).toContain("https://my-registry.example.com");
  });
});
