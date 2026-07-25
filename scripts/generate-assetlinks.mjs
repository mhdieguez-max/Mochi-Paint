#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fingerprints = [];
let output = path.join(root, "public", ".well-known", "assetlinks.json");

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--fingerprint") {
    fingerprints.push(args[++index] || "");
  } else if (args[index] === "--output") {
    output = path.resolve(process.cwd(), args[++index] || "");
  } else {
    console.error(`Unknown argument: ${args[index]}`);
    process.exit(2);
  }
}

if (!fingerprints.length) {
  console.error('Usage: node scripts/generate-assetlinks.mjs --fingerprint "AA:BB:...:FF" [--fingerprint "..."] [--output path]');
  process.exit(2);
}

const fingerprintPattern = /^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/;
const normalized = [];
for (const value of fingerprints) {
  if (!fingerprintPattern.test(value)) {
    console.error(`Invalid SHA-256 fingerprint: ${value || "(empty)"}`);
    process.exit(2);
  }
  const upper = value.toUpperCase();
  if (!normalized.includes(upper)) normalized.push(upper);
}

const document = [{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: "com.mhdieguez.mochipaint",
    sha256_cert_fingerprints: normalized,
  },
}];

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, { flag: "w", mode: 0o644 });
console.log(`Wrote ${output} with ${normalized.length} validated fingerprint(s).`);
