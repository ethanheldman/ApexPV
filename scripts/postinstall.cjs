#!/usr/bin/env node
// Render runs `yarn` (= `yarn install`) at the root by default. That only
// installs the root package's deps. We need the server + client subdir deps
// installed and the client built before `start` can succeed. This script
// chains all of that off the root install.
//
// Idempotent: re-running locally is fast (npm install no-ops if up-to-date,
// client build is the only meaningful cost on second run).
//
// Avoid recursion: an env flag short-circuits if a subdir install triggers
// this script again.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

if (process.env.APEX_POSTINSTALL_RUNNING) {
  process.exit(0);
}
process.env.APEX_POSTINSTALL_RUNNING = "1";

const root = path.resolve(__dirname, "..");
const server = path.join(root, "server");
const client = path.join(root, "client");

function run(cmd, cwd) {
  console.log(`\n[postinstall] $ ${cmd}  (cwd: ${path.basename(cwd)})`);
  execSync(cmd, { cwd, stdio: "inherit", env: process.env });
}

function tryRun(cmd, cwd, why) {
  try {
    run(cmd, cwd);
  } catch (e) {
    console.warn(`[postinstall] non-fatal: ${why}: ${e.message}`);
  }
}

// 1. Install subdir deps
run("npm install --no-audit --no-fund", server);
run("npm install --no-audit --no-fund", client);

// 2. Rebuild better-sqlite3 against the active Node ABI (only meaningful when
//    a different Node version is in use, e.g. across local <-> deploy).
tryRun("npm rebuild better-sqlite3", server, "better-sqlite3 rebuild");

// 3. Build the client. Skip locally if dist already exists and we're not on a
//    deploy host — saves ~10s on every `npm install` during development.
const distIndex = path.join(client, "dist", "index.html");
const isDeploy = !!process.env.RENDER || !!process.env.CI || !!process.env.VERCEL;
if (isDeploy || !fs.existsSync(distIndex)) {
  run("npm run build", client);
} else {
  console.log("[postinstall] client/dist already built — skipping (dev mode)");
}

console.log("\n[postinstall] done.");
