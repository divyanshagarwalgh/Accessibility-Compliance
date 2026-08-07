/**
 * One command to build and serve the extension: `node run.mjs`
 *
 * Deliberately avoids npm. Two separate things break `npm run` on this machine:
 *
 *   1. PowerShell's execution policy blocks npm.ps1 outright —
 *      "running scripts is disabled on this system". Changing that is a
 *      system security setting and not something this project should require.
 *   2. This project's path contains an '&', which truncates npm's Windows
 *      shims, so even where npm runs, bare `tsc` fails with MODULE_NOT_FOUND.
 *
 * `node.exe` is a real executable, so neither applies to it. Every step below is
 * a direct node invocation for that reason.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const TSC = join(HERE, "node_modules", "typescript", "bin", "tsc");
// The Webflow CLI is not a dependency of this package — it already exists in
// webflow-components/, so it is used from there rather than installed twice.
const CLI = join(
  HERE,
  "..",
  "webflow-components",
  "node_modules",
  "@webflow",
  "webflow-cli",
  "dist",
  "index.js",
);

function step(label, args, { fatalHint } = {}) {
  process.stdout.write(`\n[${label}]\n`);
  const result = spawnSync(process.execPath, args, { cwd: HERE, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n${label} failed (exit ${result.status}).`);
    if (fatalHint) console.error(fatalHint);
    process.exit(result.status ?? 1);
  }
}

for (const [label, path] of [["TypeScript", TSC], ["Webflow CLI", CLI]]) {
  if (!existsSync(path)) {
    console.error(
      `Cannot find ${label} at:\n  ${path}\n\n` +
        (label === "TypeScript"
          ? "Run `node ..\\node_modules\\npm\\bin\\npm-cli.js install` in page-builder/ first."
          : "Expected it in webflow-components/node_modules — has that package been installed?"),
    );
    process.exit(1);
  }
}

step("1/3 generate", [join(HERE, "generate-data.mjs")], {
  fatalHint:
    "A selector in webflow-pages/shared.css cannot be expressed as a Webflow style.\n" +
    "It must be a single class with at most one pseudo state.",
});

step("2/3 compile", [TSC, "-p", join(HERE, "tsconfig.json")]);

process.stdout.write("\n[3/3 serve]\n");
console.log("Leave this window open while you use the extension in the Designer.");
console.log("Stop it with Ctrl+C when you are done.\n");

const server = spawn(process.execPath, [CLI, "extension", "serve"], {
  cwd: HERE,
  stdio: "inherit",
});
server.on("exit", (code) => process.exit(code ?? 0));
