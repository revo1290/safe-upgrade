import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { program } from "commander";
import ora from "ora";
import { analyze } from "./analyzer.js";
import { loadConfig } from "./config.js";
import { renderJson, renderTerminal } from "./reporter.js";
import type { SafeUpgradeConfig } from "./types.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
  version: string;
};

program
  .name("safe-upgrade")
  .description("Classify npm dependency updates by risk level")
  .version(pkg.version, "-v, --version")
  .option("--apply", "automatically install safe packages")
  .option("--dry-run", "preview what --apply would do without making changes")
  .option("--json", "output results as JSON (useful for CI)")
  .option("--include-dev", "include devDependencies in analysis")
  .option("--ignore <packages>", "comma-separated list of packages to ignore")
  .option("--github-token <token>", "GitHub token for fetching release notes")
  .option("--cwd <path>", "working directory (defaults to current directory)")
  .action(
    async (options: {
      apply?: boolean;
      dryRun?: boolean;
      json?: boolean;
      includeDev?: boolean;
      ignore?: string;
      githubToken?: string;
      cwd?: string;
    }) => {
      const cwd = resolve(options.cwd ?? process.cwd());

      if (!existsSync(resolve(cwd, "package.json"))) {
        console.error(`Error: No package.json found in ${cwd}`);
        process.exit(1);
      }

      if (options.apply && options.dryRun) {
        console.error("Error: --apply and --dry-run cannot be used together");
        process.exit(1);
      }

      const fileConfig = loadConfig(cwd);

      const ignored =
        options.ignore
          ?.split(",")
          .map((s) => s.trim())
          .filter(Boolean) ?? fileConfig.ignore;
      const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN ?? fileConfig.githubToken;

      const config: SafeUpgradeConfig = {
        ...(ignored !== undefined && { ignore: ignored }),
        ...(githubToken !== undefined && { githubToken }),
        ...(fileConfig.registryUrl !== undefined && { registryUrl: fileConfig.registryUrl }),
        includeDevDependencies: options.includeDev ?? fileConfig.includeDevDependencies ?? false,
        jsonOutput: options.json ?? false,
        apply: options.apply ?? false,
        dryRun: options.dryRun ?? false,
      };

      const spinner = config.jsonOutput ? null : ora("Analyzing dependencies...").start();
      let exitCode = 0;

      try {
        const result = await analyze(cwd, config);
        spinner?.succeed(`Analyzed ${result.totalCount} packages`);

        if (config.jsonOutput) {
          console.log(renderJson(result));
        } else {
          console.log(renderTerminal(result));
        }

        if (config.apply && result.safe.length > 0) {
          const pkgArgs = result.safe.map((p) => `${p.update.name}@${p.update.latest}`);
          const count = result.safe.length;
          const label = count === 1 ? "package" : "packages";

          if (config.dryRun) {
            console.log(`\nWould run: npm install ${pkgArgs.join(" ")}`);
          } else {
            const applySpinner = ora(`Installing ${count} safe ${label}...`).start();
            try {
              execFileSync("npm", ["install", ...pkgArgs], {
                cwd,
                stdio: "ignore",
                timeout: 120_000,
                env: { ...process.env },
              });
              applySpinner.succeed(`Installed ${count} safe ${label}`);
            } catch {
              applySpinner.fail("Installation failed — run npm install manually");
              exitCode = 1;
            }
          }
        } else if (config.dryRun && result.safe.length > 0) {
          const pkgArgs = result.safe.map((p) => `${p.update.name}@${p.update.latest}`);
          console.log(`\nDry run — would install: npm install ${pkgArgs.join(" ")}`);
        }

        if (result.manual.length > 0) exitCode = 1;
      } catch (err) {
        spinner?.fail("Analysis failed");
        console.error(err instanceof Error ? err.message : String(err));
        exitCode = 1;
      }

      process.exit(exitCode);
    },
  );

program.parse();
