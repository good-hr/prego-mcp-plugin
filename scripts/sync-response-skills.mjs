#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "skills/prego-interpretation/SKILL.md",
  "skills/prego-interpretation/references/payroll.md",
];
const BACKEND_ROOT_SEGMENTS = [
  "application",
  "src",
  "main",
  "resources",
  "prego-mcp",
  "skills",
  "prego-interpretation",
];

function parseArguments(args) {
  let backendRoot;
  let check = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--check") {
      check = true;
      continue;
    }
    if (args[index] === "--backend-root" && args[index + 1]) {
      backendRoot = resolve(args[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Usage: ${process.argv[1]} --backend-root PATH [--check]`);
  }
  if (!backendRoot) throw new Error(`Usage: ${process.argv[1]} --backend-root PATH [--check]`);
  return { backendRoot, check };
}

function destination(backendRoot, source) {
  const relative = source.replace("skills/prego-interpretation/", "");
  return resolve(backendRoot, ...BACKEND_ROOT_SEGMENTS, relative);
}

function sync({ backendRoot, check }) {
  let mismatch = false;
  for (const relative of FILES) {
    const source = readFileSync(resolve(PLUGIN_ROOT, relative));
    const target = destination(backendRoot, relative);
    let current;
    try {
      current = readFileSync(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      current = null;
    }
    if (current?.equals(source)) continue;
    if (check) {
      mismatch = true;
      process.stderr.write(`Out of sync: ${target}\n`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
    process.stdout.write(`Synced: ${target}\n`);
  }
  if (mismatch) process.exitCode = 1;
}

try {
  sync(parseArguments(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
