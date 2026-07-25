# Google Play and TWA handoff

This is an engineering handoff, not a guarantee of store approval or legal advice. Mochi Paint is intended for all ages, including children, so Google Play Families requirements remain applicable. The arithmetic gateway is exit friction only; it is not proof of age, identity, parental consent, or a legally verified parental-consent mechanism.

## Locked release details

- App and launcher name: `Mochi Paint`
- Android package: `com.mhdieguez.mochipaint`
- Web host: `summer-silence-662e.mhdieguez.workers.dev`
- Launch path and web scope: `/`
- Packaging: Bubblewrap Trusted Web Activity
- Output: Android App Bundle (`.aab`)
- Target SDK: Android API 36
- Accounts, ads, analytics, trackers, gallery, cloud uploads, and social features: none
- Save behavior: local `mochi-paint.png` download only

## Before generating the Android wrapper

1. Run `node scripts/compliance-audit.mjs`.
2. Test the production web origin and confirm normal use contacts only the Mochi Paint origin. Include Home, every theme, all 46 character cards, coloring, Save, Print, undo/redo, and Kori.
3. Validate the PWA manifest, service-worker registration, offline relaunch, the maskable icon safe zone, and installability.
4. Confirm Privacy, Data Deletion, `mailto:`, and future external-domain links pass through the gateway. Internal navigation, Save, and Print must not.
5. Do not publish `assetlinks.json` until a real signing fingerprint exists.

## Bubblewrap scaffold

Use a current Bubblewrap CLI and initialize from the deployed manifest:

```text
bubblewrap init --manifest=https://summer-silence-662e.mhdieguez.workers.dev/manifest.webmanifest
```

Confirm these values during initialization:

```text
Application name: Mochi Paint
Launcher name: Mochi Paint
Package ID: com.mhdieguez.mochipaint
Host: summer-silence-662e.mhdieguez.workers.dev
Start URL: /
Display mode: standalone
Notifications: disabled
```

After generation, set both `compileSdk` and `targetSdk` to 36 if the generated project does not already do so. Build an Android App Bundle only after web QA passes. Keep the generated wrapper under `android/`; `.gitignore` excludes generated build output and signing files.

Do not commit or transmit keystores, passwords, signing secrets, service credentials, or local properties. Signing-key generation and Play Console enrollment require owner approval.

## Digital Asset Links

Generate the file only with a real SHA-256 certificate fingerprint:

```text
node scripts/generate-assetlinks.mjs --fingerprint "AA:BB:...:FF"
```

For local TWA verification, start with the release/upload certificate fingerprint. After Play App Signing is enabled, rerun the generator with both the upload/release fingerprint and Google Play's app-signing fingerprint.

Before release, verify:

- `https://summer-silence-662e.mhdieguez.workers.dev/.well-known/assetlinks.json` returns HTTP 200.
- The response is valid JSON, has no redirect, and identifies only `com.mhdieguez.mochipaint`.
- The fingerprints exactly match the installed/test certificate and, later, the Play app-signing certificate.
- The installed app opens full-screen as a TWA rather than falling back to a Custom Tab.

Never deploy a placeholder fingerprint.

## Android build inspection

Inspect the merged manifest from the release bundle:

```text
node scripts/audit-android-manifest.mjs android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml
```

The audit rejects advertising ID, camera, microphone, contacts, location, media, and legacy external-storage permissions. Also verify the built artifact reports:

- package `com.mhdieguez.mochipaint`
- target SDK 36
- the expected signing certificate
- no unexpected SDKs, components, or permissions

## Play Console declarations

- Target audience: every age group the product is genuinely designed for, including children
- Families Policy: applicable because children are included
- Ads: no
- Data Safety: no data collected and no data shared, subject to final release-build network verification
- Social features: none
- Neutral age screen: unnecessary because features do not vary by age and there is no adult-only feature
- Privacy-policy URL: public, same-origin Privacy page
- App access: no login
- Content rating: child-appropriate coloring application
- Play App Signing: add the Play app-signing fingerprint to `assetlinks.json` before production

Record final network traces, PWA results, gateway accessibility results, manifest/permission inspection, signing-certificate fingerprints, Digital Asset Links validation, and regression results with the release record. Escalate unresolved policy questions to qualified counsel.
