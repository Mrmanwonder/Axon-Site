# Production-readiness notes

## Architecture and security audit (14 September 2026)

Axon is a Vite 7 / React 19 SPA using React Router's browser router. The authenticated
shell lives under `src/ui/`; Supabase provides authentication and data access; scanner
modules remain dynamically imported. Netlify and the Cloudflare static-assets Worker
are the two deployment configurations. There is no service worker, form library,
advertising SDK, tag manager, or product analytics SDK.

The source/configuration scan found one Supabase publishable key. It is designed for
browser delivery and has no anonymous data policies; it is not a service-role secret.
No private credential was found, removed, or exposed by this change, so no credential
rotation is currently indicated. Private Supabase, Stripe, R2, OpenRouter and worker
credentials must remain in their platform secret stores and must never use a `VITE_`
prefix. `VITE_SITE_URL` is public configuration only.

Expensive scan operations already require the caller's JWT, prove resource ownership
through RLS, cap a paper at 25 pages, cap an upload request at 60 objects and each
declared object at 25 MiB, and constrain worker concurrency through queue batches.
Supabase provides auth-email/OTP abuse controls. No CAPTCHA was added: there is no
unauthenticated Axon-owned content or AI form to justify its privacy/accessibility cost.
Before broad launch, the owner should set and monitor account-level scan quotas and
confirm upstream Supabase auth rate-limit settings.

## Privacy, consent and analytics

Storage is classified as strictly necessary (session continuity, preferences, offline
cache and scan drafts) or as the existing itemised guardian consent ledger for study
processing. Axon has no advertising/marketing tracker and no separate product analytics
tracker, so a cookie banner would be a fake choice and is intentionally not shown.
Settings remains the place to revisit guardian consent, and the Privacy Policy explains
necessary local storage. Any future non-essential analytics must be consent-gated before
initialisation and requires a versioned policy update.

## Search and metadata

Only `/privacy` and `/terms` are intentionally indexed. Auth, onboarding, dashboard,
library, scanner, review, settings and invalid routes are `noindex`; they are excluded
from the sitemap. `robots.txt` is crawler guidance, not access control. Canonical and
social URLs use `https://axonstudy.online`, matching the deployed site origin configured
for the Worker. Change that origin together in Wrangler, `VITE_SITE_URL`, robots and the
sitemap if the canonical domain changes.

## Deployment

Both supported hosts redirect or provision HTTPS at the edge. Netlify sends HSTS,
nosniff, referrer, frame, permissions and a scanner-compatible CSP. The CSP explicitly
keeps camera, module workers, blob previews, Supabase HTTP/WebSocket, R2 images and the
Mastery API available. The Cloudflare Worker enforces HTTPS and emits the transport
headers; keep the platform's asset binding configured for SPA fallback. Static Vite
assets and fonts are cached immutably while `index.html` revalidates.

## Performance record

The pre-change local production output was 7,320,878 bytes including source maps. The
largest runtime JS file was 873,572 bytes (the scanner remains dynamically loaded) and
the main CSS was 101,744 bytes. Public assets before the change were a single 32,236-byte
font. New branded artwork is source-controlled SVG rather than binary image data. Record
post-change output with `du -sb dist` and browser request totals after each release. No
source scan/OCR compression or canvas utility was changed.

Lighthouse could not produce a meaningful authenticated baseline without a seeded test
account and reachable production services. Run mobile and desktop Lighthouse against
the deployed `/privacy`, onboarding/auth, and a seeded authenticated home, recording
LCP, CLS and TBT in the release ticket. Targets are LCP below 2.5s and CLS below 0.1 on
the agreed mobile profile, not guarantees for every device or network.

## Owner and legal follow-up

All unresolved statements are visibly marked in the pages. Owners/legal counsel must
confirm: the contracting entity and contact details; the processor list/notices; data,
backup, log and billing retention; supported countries and ages; guardian-verification
wording; international-transfer mechanism; warranty/liability language; governing law,
venue and dispute process. These placeholders must be resolved before public launch.

## Manual release QA

At 320, 360, 375, 390, 414, 768 and desktop widths, test direct navigation to both
legal routes and an invalid route, keyboard focus/order, footer links, theme contrast,
and absence of horizontal overflow. With a real phone on an HTTPS deploy, separately
exercise permission, preview, capture, preview image, canvas conditioning, upload,
processing, retake, cancel/back and orientation changes. Also exercise OTP and provider
auth, profile validation, consent withdrawal, billing errors, and account deletion.
These are manual gates; do not infer they passed from unit tests.
