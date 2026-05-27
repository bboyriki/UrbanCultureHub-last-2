#!/usr/bin/env node
/**
 * Patches installed packages that use the `node:` protocol for built-in
 * modules, making them compatible with Node.js < 14.18 (e.g. Replit's env).
 * Runs automatically via the `postinstall` npm hook.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const targets = [
  'node_modules/get-tsconfig/dist/index.cjs',
];

for (const rel of targets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.log(`[patch-node-protocol] Skipping (not found): ${rel}`);
    continue;
  }
  const original = fs.readFileSync(file, 'utf8');
  // Replace require("node:xyz") and require('node:xyz') with require("xyz")
  const patched = original
    .replace(/require\("node:([^"]+)"\)/g, 'require("$1")')
    .replace(/require\('node:([^']+)'\)/g, "require('$1')");

  if (original !== patched) {
    fs.writeFileSync(file, patched, 'utf8');
    console.log(`[patch-node-protocol] Patched node: prefix in ${rel}`);
  } else {
    console.log(`[patch-node-protocol] Already clean: ${rel}`);
  }
}
