# Compliance QA review

Date: July 24, 2026

## Passed locally

- `node scripts/compliance-audit.mjs`: 62 checks passed.
- JavaScript syntax checks passed for the app, gateway, service worker, and compliance scripts.
- Manifest JSON parses and contains the required name, short name, root start/scope, standalone display, colors, and PNG icon entries.
- Icon dimensions are 192×192, 512×512, and 512×512 maskable.
- All local font files are valid WOFF2 files.
- Digital Asset Links generation rejects an invalid fingerprint and produces valid package-scoped JSON from a valid test fingerprint written outside the repository.
- No placeholder `public/.well-known/assetlinks.json` was created.
- Local request logs showed same-origin app assets and locally hosted fonts; no Google Fonts, Supabase, analytics, or advertising hosts appeared.
- The Home page rendered all 46 character cards.
- Kori opened through normal internal navigation without a gateway.
- Gateway incorrect-answer feedback stayed in the dialog.
- Gateway Cancel kept the user on the original page and restored focus to the Privacy link.
- A correct answer submitted with Enter opened the pending Privacy page.
- Save produced the `Saved as mochi-paint.png` result and the implementation contains no Web Share API.
- `git diff --check` passed.

## Required before release

These checks require a deployed candidate, real Android wrapper, or signing certificate and were intentionally not claimed as passed:

- Production-origin network trace covering normal use and all character/theme paths.
- HTTPS service-worker installation and airplane-mode relaunch for Home, default Usagi, cached characters, and an uncached character.
- PWA installability and maskable-icon safe-zone visual inspection on Android.
- Bubblewrap generation, API 36 build, APK/AAB inspection, and signing verification.
- Merged Android manifest permission audit.
- Digital Asset Links publication with real upload/release and Play app-signing fingerprints.
- Full-screen TWA verification instead of Custom Tab fallback.
- Play Console declarations and final policy/legal review.

No deployment, keystore generation, or signing-secret creation was performed.
