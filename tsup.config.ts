import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node18",
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node18",
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
