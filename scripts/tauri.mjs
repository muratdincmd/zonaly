/**
 * `npm run tauri -- build` wrapper: run the Tauri CLI, then kebab-case the
 * current version's Windows installer filenames.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renameSpacedBundleArtifacts } from "./rename-bundle-artifacts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tauriCli = require.resolve("@tauri-apps/cli/tauri.js");
const args = process.argv.slice(2);

const child = spawn(process.execPath, [tauriCli, ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if ((code ?? 1) === 0 && args[0] === "build") {
    const renamed = renameSpacedBundleArtifacts(root);
    for (const item of renamed) {
      console.warn(`bundle artifact → ${item.to}`);
    }
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
