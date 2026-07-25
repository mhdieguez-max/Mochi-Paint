#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const failures = [];
let passed = 0;
const fail = (message) => failures.push(message);
const pass = () => { passed += 1; };
const exists = (relative) => fs.existsSync(path.join(root, relative));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const scanFiles = walk(publicDir)
  .filter((file) => [".html", ".js", ".css", ".json", ".md", ".xml"].includes(path.extname(file).toLowerCase()));
for (const dependencyFile of ["package.json", "package-lock.json"]) {
  if (exists(dependencyFile)) scanFiles.push(path.join(root, dependencyFile));
}
const forbidden = [
  ["Google Analytics / Tag Manager", /googletagmanager|google-analytics|gtag\s*\(/i],
  ["Firebase Analytics", /firebase[\s._/-]*analytics/i],
  ["Meta/Facebook Pixel", /\bfbq\s*\(|facebook[\s._/-]*pixel/i],
  ["Hotjar", /\bhotjar\b|hj\s*\(/i],
  ["Microsoft Clarity", /clarity\.ms|clarity\s*\(/i],
  ["Mixpanel", /\bmixpanel\b/i],
  ["Segment", /segment\.com/i],
  ["Amplitude", /\bamplitude\b/i],
  ["AppsFlyer", /\bappsflyer\b/i],
  ["AdMob / AdSense / DoubleClick", /\badmob\b|adsbygoogle|doubleclick\.net/i],
  ["Supabase runtime", /supabase\.co|createClient\s*\(/i],
  ["Google-hosted fonts", /fonts\.googleapis\.com|fonts\.gstatic\.com/i],
  ["Native Web Share", /navigator\.(?:share|canShare)\b/i],
];

for (const [label, pattern] of forbidden) {
  const hits = scanFiles.filter((file) => pattern.test(fs.readFileSync(file, "utf8"))).map((file) => path.relative(root, file));
  hits.length ? fail(`${label}: ${hits.join(", ")}`) : pass();
}

for (const removed of ["public/config.js", "public/supabase-schema.sql"]) {
  exists(removed) ? fail(`Obsolete file exists: ${removed}`) : pass();
}

for (const file of [
  "public/manifest.webmanifest", "public/sw.js", "public/parental-gate.js", "public/parental-gate.css", "public/fonts.css",
  "public/fonts/poppins-400.woff2", "public/fonts/poppins-500.woff2", "public/fonts/poppins-600.woff2",
  "public/fonts/poppins-700.woff2", "public/fonts/baloo-2-latin.woff2", "public/fonts/nunito-latin.woff2",
  "public/fonts/quicksand-latin.woff2", "public/icon-192.png", "public/icon-512.png", "public/icon-512-maskable.png",
]) {
  exists(file) ? pass() : fail(`Missing ${file}`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf8"));
} catch (error) {
  fail(`Manifest is invalid JSON: ${error.message}`);
}
if (manifest) {
  for (const [key, value] of Object.entries({
    name: "Mochi Paint", short_name: "Mochi Paint", start_url: "/", scope: "/", display: "standalone",
  })) {
    manifest[key] === value ? pass() : fail(`Manifest ${key} must be ${JSON.stringify(value)}`);
  }
  manifest.theme_color && manifest.background_color ? pass() : fail("Manifest colors are required");
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png") ? pass() : fail("Manifest needs 192x192 PNG");
  icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png") ? pass() : fail("Manifest needs 512x512 PNG");
  icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any maskable") ? pass() : fail('Manifest needs purpose "any maskable"');
}

for (const page of ["index.html", "home.html", "theme.html", "privacy.html", "data-deletion.html", "forest-kawaii.html"]) {
  const html = fs.readFileSync(path.join(publicDir, page), "utf8");
  /Content-Security-Policy/i.test(html) ? pass() : fail(`${page} is missing a CSP`);
  /href=["']\/manifest\.webmanifest["']/i.test(html) ? pass() : fail(`${page} is missing the manifest link`);
  /href=["']\/fonts\.css["']/i.test(html) ? pass() : fail(`${page} is missing local fonts`);
}

const appJs = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
/download\s*=\s*["']mochi-paint\.png["']/.test(appJs) ? pass() : fail("Save must download mochi-paint.png");

const sw = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
sw.includes("/coloring-pages/meadow/usagi-bunny.png") ? pass() : fail("Service worker must precache default Usagi");
(sw.match(/\/coloring-pages\//g) || []).length <= 4 ? pass() : fail("Service worker precaches too much artwork");

for (const page of ["home.html", "theme.html"]) {
  const html = fs.readFileSync(path.join(publicDir, page), "utf8");
  const links = [...html.matchAll(/<a\b[^>]*href=["'][^"']*(?:privacy|data-deletion)[^"']*["'][^>]*>/gi)];
  links.length && links.every((match) => /data-parental-gate/i.test(match[0]))
    ? pass()
    : fail(`${page} must gate every policy exit`);
}

console.log(`Mochi Paint compliance audit: ${passed} checks passed.`);
if (failures.length) {
  console.error(`${failures.length} check(s) failed:`);
  for (const message of failures) console.error(`  FAIL  ${message}`);
  process.exitCode = 1;
} else {
  console.log("No prohibited integrations or required-file failures detected.");
}
