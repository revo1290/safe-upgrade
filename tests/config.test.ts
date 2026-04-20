import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

let tmp: string;

beforeEach(() => {
  tmp = join(tmpdir(), `safe-upgrade-test-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns empty object when no config found", () => {
    expect(loadConfig(tmp)).toEqual({});
  });

  it("loads from .safe-upgrade.json", () => {
    writeFileSync(
      join(tmp, ".safe-upgrade.json"),
      JSON.stringify({ ignore: ["lodash"], includeDevDependencies: true }),
    );
    const config = loadConfig(tmp);
    expect(config.ignore).toEqual(["lodash"]);
    expect(config.includeDevDependencies).toBe(true);
  });

  it("loads from package.json safe-upgrade key", () => {
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({
        name: "test",
        "safe-upgrade": { ignore: ["react"], includeDevDependencies: false },
      }),
    );
    const config = loadConfig(tmp);
    expect(config.ignore).toEqual(["react"]);
    expect(config.includeDevDependencies).toBe(false);
  });

  it("prefers .safe-upgrade.json over package.json", () => {
    writeFileSync(join(tmp, ".safe-upgrade.json"), JSON.stringify({ ignore: ["from-rc"] }));
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ "safe-upgrade": { ignore: ["from-pkg"] } }),
    );
    expect(loadConfig(tmp).ignore).toEqual(["from-rc"]);
  });

  it("strips unknown keys", () => {
    writeFileSync(
      join(tmp, ".safe-upgrade.json"),
      JSON.stringify({ unknown: true, ignore: ["x"] }),
    );
    const config = loadConfig(tmp);
    expect("unknown" in config).toBe(false);
    expect(config.ignore).toEqual(["x"]);
  });

  it("rejects invalid registryUrl", () => {
    writeFileSync(join(tmp, ".safe-upgrade.json"), JSON.stringify({ registryUrl: "not-a-url" }));
    expect(loadConfig(tmp).registryUrl).toBeUndefined();
  });

  it("accepts valid registryUrl", () => {
    writeFileSync(
      join(tmp, ".safe-upgrade.json"),
      JSON.stringify({ registryUrl: "https://my-registry.example.com" }),
    );
    expect(loadConfig(tmp).registryUrl).toBe("https://my-registry.example.com");
  });

  it("ignores malformed JSON gracefully", () => {
    writeFileSync(join(tmp, ".safe-upgrade.json"), "{ invalid json");
    expect(loadConfig(tmp)).toEqual({});
  });

  it("ignores non-object config values", () => {
    writeFileSync(join(tmp, ".safe-upgrade.json"), JSON.stringify([1, 2, 3]));
    expect(loadConfig(tmp)).toEqual({});
  });
});
