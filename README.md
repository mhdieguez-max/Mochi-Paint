# Mochi Paint

Mochi Paint is an all-ages, installable coloring PWA hosted as static assets
with Cloudflare Workers. It has no accounts, advertisements, analytics,
third-party trackers, gallery, or cloud artwork uploads.

## Local development

```bash
python3 -m http.server 8000 --directory public
```

Open `http://localhost:8000/`.

## Compliance checks

```bash
node scripts/compliance-audit.mjs
```

The audit verifies the PWA manifest, local fonts, parental-gate integration,
service-worker shell, and absence of known tracking or sharing integrations.

Android/TWA setup and Play Console declarations are documented in
`docs/google-play-handoff.md`.
