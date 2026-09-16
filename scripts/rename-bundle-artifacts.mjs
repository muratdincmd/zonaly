/**
 * Tauri 2.11 names NSIS/MSI from `productName`, which may contain spaces or
 * capitals. Display name stays as configured; artifacts become
 * `{package.json name}_{version}_…`. Only the **current** version is renamed
 * so leftover older builds in `target/` are left alone.
 */
import { existsSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_KINDS = ["nsis", "msi", "nsis-updater"];
const SKIP_DIRS = new Set([".fingerprint", "build", "deps", "incremental", "examples"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function artifactIdentity(root) {
  const pkg = readJson(join(root, "package.json"));
  const tauri = readJson(join(root, "src-tauri", "tauri.conf.json"));
  const displayPrefix = String(tauri.productName ?? "");
  const artifactPrefix = String(pkg.name ?? "");
  const version = String(pkg.version ?? "");
  if (!displayPrefix || !artifactPrefix || !version) {
    throw new Error("productName, package.json name, and version are required");
  }
  return { displayPrefix, artifactPrefix, version };
}

export function kebabBundleArtifactName(filename, identity) {
  const from = `${identity.displayPrefix}_${identity.version}`;
  if (!filename.startsWith(from)) {
    return null;
  }
  return `${identity.artifactPrefix}_${identity.version}${filename.slice(from.length)}`;
}

function listDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function renameInDir(dir, identity, renamed) {
  for (const entry of listDir(dir)) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      renameInDir(full, identity, renamed);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const nextName = kebabBundleArtifactName(entry.name, identity);
    if (!nextName || nextName === entry.name) {
      continue;
    }
    const dest = join(dir, nextName);
    if (existsSync(dest)) {
      rmSync(dest);
    }
    renameSync(full, dest);
    renamed.push({ from: full, to: dest });
  }
}

function walkForBundle(dir, depth, identity, renamed) {
  if (depth > 8) {
    return;
  }
  for (const entry of listDir(dir)) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.name === "bundle") {
      for (const kind of BUNDLE_KINDS) {
        renameInDir(join(full, kind), identity, renamed);
      }
      continue;
    }
    walkForBundle(full, depth + 1, identity, renamed);
  }
}

export function renameSpacedBundleArtifacts(root) {
  const target = join(root, "src-tauri", "target");
  const renamed = [];
  if (!existsSync(target)) {
    return renamed;
  }
  walkForBundle(target, 0, artifactIdentity(root), renamed);
  return renamed;
}

const thisFile = resolve(fileURLToPath(import.meta.url));
const invokedAsCli = Boolean(process.argv[1] && resolve(process.argv[1]) === thisFile);
if (invokedAsCli) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const renamed = renameSpacedBundleArtifacts(root);
  for (const item of renamed) {
    console.warn(`${basename(item.from)} → ${basename(item.to)}`);
  }
}
