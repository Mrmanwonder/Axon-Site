# Mastery

A responsive web app that shows a student exactly where their marks go — built from
the original single-file device-frame prototype, now a real site rather than a
scaled-down phone mockup.

`index.html` is the front end and the design system. `src/` holds ES modules for data
and flow; `vendor/` holds the Supabase client. No bundler, no framework, no install.

It must be **served**, not opened as a file — ES modules do not load over `file://`.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## What works

- **Auth** — passwordless: email or phone OTP, or Continue with Google / Continue with
  Apple. Only the guardian holds credentials; the student is a profile under that
  session. A provider sign-in skips nothing — see *Provider sign-in* below.
- **Onboarding** — the eight steps in order, with the legally load-bearing ones
  enforced: no student data before consent, consent itemised per purpose with optional
  purposes off, payment after consent.
- **Guardian verification** — a swappable adapter. The development stub is wired;
  DigiLocker is the intended production adapter and needs a server-side token
  exchange. Only a reference and a timestamp are ever stored.
- **Settings** — appearance, text size, reduce motion, reasoning, and notification
  switches all persist. The weekly-digest and improve-extraction switches write to the
  consent ledger instead of preferences, so turning one off is a recorded withdrawal.
- **Ingestion** — upload pages or a PDF to private storage, or paste a link. The paper
  type is asked once because it decides Tier 1 vs Tier 2.
- **Data export and account deletion**, both from Settings.

## What does not work yet

Extraction. Pages reach storage and are recorded, but nothing reads them, so no
attempts or mark-loss events are produced yet. That is milestone 5, and CLAUDE.md
wants the OCR accuracy harness (milestone 2) settled first — red-pen extraction is the
riskiest assumption in the product.

Links are stored `pending`: a browser cannot fetch a cross-origin PDF and hand over the
bytes, so a server-side fetcher has to resolve them.

## Deploying

`netlify.toml` copies `index.html`, `src/` and `vendor/` into `dist/` and publishes
that. The publish directory is explicit rather than the repo root, so the Constitution
specs, the blueprint and the design reference images stay out of the deployed site.

There is nothing to install — no `package.json`, no framework, no build step beyond
the copy.

### Provider sign-in

Google and Apple are offered on the account step, above the typed path. Both are pure
client-side redirects through Supabase (`signInWithOAuth`), so there is nothing to
install and no secret in this repo — but each has to be switched on once, per project,
in the Supabase dashboard:

- **Google** — Authentication → Sign In / Providers → Google. Needs an OAuth client ID
  and secret from the Google Cloud console, with Supabase's callback
  (`<project>.supabase.co/auth/v1/callback`) as an authorised redirect URI.
- **Apple** — the same panel. Needs a Services ID, and Apple requires the callback to
  be an `https` URL, so this one cannot be exercised against `http://localhost`; use a
  deploy preview.

Add every origin the app is served from — production, deploy previews, `localhost` for
Google — to Authentication → URL Configuration → Redirect URLs. The app asks to come
back to `window.location.origin + pathname` rather than the project's Site URL, so a
stale Site URL cannot strand anyone, but an origin missing from that allow-list will be
refused by Supabase.

Until a provider is enabled its button explains itself in amber and points at the email
and phone path, rather than surfacing Supabase's developer-facing error.

**A provider shortens no part of the flow.** It supplies a verified address and, usually,
a name — so the guardian row lands with one glance instead of two fields. It does not
stand in for guardian verification, and it cannot: DPDP consent is a parent's decision
about a specific child, and no identity provider can assert it. The age gate,
verification and itemised consent all still run, in order.

The Supabase publishable key is committed in `src/config.js` on purpose. It carries no
authority: every table has RLS with no policy for `anon`, so the key alone reaches
nothing, and it is the signed-in session that grants access.

## Typography

Onest is embedded in the document as a base64 `woff2` (the latin variable subset,
covering 400–700 in one 32KB file). Self-hosting it removes two external requests
and a render-blocking stylesheet, so the real face paints on the first frame with
no fallback flash — and the page renders correctly with no network at all.

## Layout

| Viewport | Navigation | Content |
| --- | --- | --- |
| `< 768px` | Floating glass tab bar, bottom | Single column |
| `≥ 768px` | Persistent left rail, icons only (76px) | Home two-up, Insights in 2 columns |
| `≥ 1024px` | Same rail with labels (216px) | Content column caps and centres |

Between those points, type and spacing scale continuously with `clamp()` — the
gutter, heading sizes, insight headline and card radius all ramp with the viewport
rather than snapping at a breakpoint, so the two layouts read as one design.

Library rows stay single-column at every width; they're already dense, and a second
column would only shorten each row's usable text.

## The glass and the physics

Both are carried over from the prototype intact, not re-approximated.

**The lens.** The tab bar's highlight is a real `feDisplacementMap`, not a
`backdrop-filter`. `generateLensMap()` renders a signed-distance normal map to a
canvas and feeds it to the filter as a data URI, so the pill genuinely refracts the
content behind it. The nav is one DOM subtree in both orientations, and every
coordinate — `x`, `y`, `width`, `height` — comes from measuring the real tab rects,
which is what lets the same code drive a horizontal tab bar and a vertical rail.
The map is regenerated on resize and on every breakpoint crossing, then cached by
size so a resize storm doesn't rebuild an identical canvas each frame.

Measurements are taken against `#refractlayer`, the filter's own reference box, so
the pill, the displacement map and the icons all share one origin.

**The springs.** `spring()` is the original velocity-integrating solver. Press
states, the pill glide, switch thumbs and sheet transitions all run through it. The
pill's squash-stretch follows the axis of travel — horizontal in the tab bar,
vertical in the rail.

## Haptics

`navigator.vibrate`, weighted to the interaction, feature-detected and silent where
unsupported (which is every desktop browser):

- **10ms tick** — tab bar selection, settings switch toggles, camera shutter
- **18ms pulse** — confirming something consequential: the board/class warning
  sheet's primary button, and *Confirm & save to Library*

Deliberately silent on scrolling, row taps, filter chips, disclosure toggles, and
the lightweight link/upload confirmations that share the warning sheet's markup.
The tick is bound to the tab elements rather than to `pick()`, so programmatic
navigation doesn't buzz.

## Themes

Dark and light are equal first-class modes, defined as custom properties on the root
element. Switch via Appearance in Settings (Light / Dark / System) or the corner
button. `prefers-reduced-motion` collapses transitions.
