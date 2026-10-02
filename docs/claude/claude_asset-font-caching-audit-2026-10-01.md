# Asset, font and caching audit (AXO-67) — 2026-10-01

Measured against production `https://axonstudy.online` (curl, 2026-10-01 ~17:00 UTC) and the local build of this branch.
Scanner CPU is **not** covered here: it needs a real mid/low-range phone (see "Not measured").

## Transfer sizes (production, cold, per resource)

| Resource | identity | gzip | brotli | Notes |
|---|---:|---:|---:|---|
| `/assets/index-BT8KFvj3.js` (entry) | 612,336 | 183,612 | 185,434 | Edge brotli is *larger* than gzip here; Cloudflare chooses the level, not us |
| `/assets/index-Vq0L0pUi.css` | 109,038 | 22,419 | 23,646 | Single render-blocking stylesheet |
| `/` (HTML) | 4,740 | 1,954 | 1,849 | |
| `/fonts/onest-latin-var.woff2` | 32,236 | 32,236 | 32,236 | WOFF2 is already compressed; correctly not re-encoded |
| `/axon-lockup-v2.png` | 23,453 | — | — | OpenGraph image; referenced only from `<meta>`, not fetched by the app |
| `/axon-logo.png` = `/favicon.png` | 13,508 | — | — | Identical bytes (same etag) served at two URLs |
| `/sw.js` | 1,961 | 911 | 903 | |

Build budget (`scripts/check-bundle-budget.mjs`): initial JS **598 KiB raw / 180 KiB gzip**, inside the 210 KiB guard. Unchanged by this PR.

## Findings

1. **Compression**: HTML/JS/CSS/manifest are compressed (br/gzip) at the edge. Fonts and PNGs are not, correctly.
2. **Immutable assets**: `/assets/*` is `public, max-age=31556952, immutable`. Correct (Vite fingerprints). A missing `/assets/<hash>.js` falls through to the SPA shell with HTTP 200 and `text/html` — worth knowing when debugging a stale-deploy chunk error, not changed here.
3. **Font cache policy — Linear baseline was wrong for production.** AXO-67's 2026-09-28 note says `/fonts/*` is one-year immutable. That is only true of `netlify.toml`. Production (Cloudflare Workers static assets) reads `public/_headers`, and live `/fonts/onest-latin-var.woff2` returns `max-age=604800, stale-while-revalidate=86400`. The file is *not* fingerprinted, so one-year immutable would be unsafe (a font revision could never reach returning users). **Decision: keep 7 days + SWR; reconcile `netlify.toml` to match** so the two configs stop disagreeing. Fingerprinting the font (move under `src/`, hash into `/assets/`) would allow immutable but touches the offline shell precache (`scripts/build-offline-shell.mjs`) and two e2e assertions for ~1 revalidation per week per user; not worth the risk now.
4. **Font loading**: one self-hosted Onest Latin variable WOFF2 (400–700), one `@font-face`, `font-display: swap`, one `<link rel=preload … crossorigin>`. No duplicate weights, no external stylesheet. `index.html` carried a stale comment saying `font-display: block`; corrected.
5. **Brand/icon files were revalidated on every page load** (`max-age=0, must-revalidate`): favicon, apple-touch-icon source, logo, lockup. **Fix**: `public/_headers` now gives these `max-age=86400, stale-while-revalidate=604800`. Effect: removes up to 3 conditional requests (favicon/logo/touch icon) per navigation within a day. *Before* values captured above; *after* values must be re-read from the deployed headers (`curl -I https://axonstudy.online/favicon.png`) once this ships — not claimed until then.
6. **Unreferenced files** in `public/`: `og-image.svg` (900 B), `favicon.svg` (2.2 KB), `axon-lockup-v2.svg` (6.2 KB). Not on any request path; left in place (total 9 KB, removal measurably changes nothing). `axon-logo.png` and `favicon.png` are byte-identical.
7. **Images**: runtime `<img>` is limited to real academic evidence (`Crop.tsx`, scan thumbnail capped at 512 px). No decorative raster path to convert to WebP/AVIF. Not lazy-loading evidence images, per the earlier note.
8. **Replay masking interacts with images**: see AXO-78 — images are now blocked from session replay (`blockSelector`), which also keeps scanned papers out of PostHog.

## Not measured (needs a human with a real device)

- Scanner main-thread cost (decode/detect cadence, overlay rAF, long tasks, dropped frames) on a real low/mid-range Android phone. Automated invariants exist (480 px proxy edge, ~22 Hz tracking cap, worker detection) but those are guarantees, not a device profile.
- Cold/warm browser traces (LCP, long tasks): owned by AXO-66.
