#!/usr/bin/env node
/**
 * Strips the `node:` built-in prefix from installed CJS packages so the app
 * runs on Node.js < 14.18 (Replit's environment).
 *
 * On Node 18/20 (Railway, local) this patch is a no-op — require("path") and
 * require("node:path") are identical, so Railway is never affected.
 *
 * Runs automatically after every `npm install` via the postinstall hook.
 * To add more files in the future, append their relative path to `targets`.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// All CJS files known to use node: prefix that break on Node < 14.18.
// Add more here if a future npm install introduces a new offender.
const targets = [
  'node_modules/get-tsconfig/dist/index.cjs',
  'node_modules/tsx/dist/cjs/index.cjs',
  'node_modules/tsx/dist/preflight.cjs',
  'node_modules/tsx/dist/pkgroll_create-require-3c9491e9.cjs',
];

let patched = 0;

for (const rel of targets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;

  const original = fs.readFileSync(file, 'utf8');
  const fixed = original
    .replace(/require\("node:([^"]+)"\)/g, 'require("$1")')
    .replace(/require\('node:([^']+)'\)/g, "require('$1')");

  if (original !== fixed) {
    fs.writeFileSync(file, fixed, 'utf8');
    console.log(`[patch-node-protocol] ✓ Patched: ${rel}`);
    patched++;
  }
}

if (patched === 0) {
  console.log('[patch-node-protocol] Nothing to patch (already clean or Node 18+).');
}
