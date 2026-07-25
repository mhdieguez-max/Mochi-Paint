#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("Usage: node scripts/audit-android-manifest.mjs path/to/merged/AndroidManifest.xml");
  process.exit(2);
}

const xml = fs.readFileSync(manifestPath, "utf8");
const requested = [...xml.matchAll(/<uses-permission\b[^>]*android:name=["']([^"']+)["'][^>]*>/g)]
  .map((match) => match[1]);
const disallowed = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_CONTACTS",
  "android.permission.WRITE_CONTACTS",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];
const found = requested.filter((permission) => disallowed.includes(permission));

if (found.length) {
  console.error(`Disallowed Android permissions: ${found.join(", ")}`);
  process.exit(1);
}

console.log(`Android manifest permission audit passed. Requested: ${requested.join(", ") || "none"}.`);
