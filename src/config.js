// Client configuration.
//
// The publishable key is designed to ship inside the client, it carries no
// authority of its own. Every table has RLS with no policy for anon, so this
// key on its own reaches nothing; it is the signed-in session that grants
// access. Committing it is intended, not an oversight.

export const SUPABASE_URL = 'https://dlgcqieyevoebefhcggi.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WZCc08bBepIIIgdsuiuYCA_5isUL0ED';

// The pipeline itself, stages 3 through 8, runs here, not in a Supabase Edge
// Function. It is a Cloudflare Worker so a sixteen-page booklet's structure and
// content passes are not fighting a 2-second CPU cap; see CLOUDFLARE_WORKERS.md.
export const MASTERY_API_URL = 'https://mastery-api.tanmay-harkawat.workers.dev';

// Version of the consent notice text currently shown in the UI. Bump this
// whenever the wording or the set of purposes changes: every consent_event
// records it, so a historical decision stays tied to what was actually agreed.
// The exact text of each version is stored in public.consent_notice_text
// (one row per version and language, seeded by migration), and
// tests/ui/consent-notice-text.test.ts fails if src/notice.js drifts from the
// stored text for this version.
//
// A bump does NOT re-prompt returning guardians. Nothing compares a stored
// notice_version with this constant: whether consent is needed is decided by
// the current grant of each required purpose (consent_current), not by which
// version it was given under. A future change that must force re-consent has
// to be built and decided explicitly; it is not a side effect of this value.
//
// 1.1.0 (7 Oct 2026, council D2): the notice as restored by PR #224, English
// and Hindi, with "Never: behavioural tracking". Consents given under 1.0.0
// stay valid.
export const CONSENT_NOTICE_VERSION = '1.1.0';

// Which guardian-verification adapter to use.
//
// Two constants rather than one, because the single constant was the bug: it
// said 'stub' — a development adapter that returns success without checking a
// person — and nothing stopped a build from shipping exactly that. A screen
// reading "Verify it's you" over an adapter that verifies nobody is a
// production trust claim the code does not implement.
//
// Split, the question "what does a shipped bundle use?" has a literal answer
// that scripts/check-production-config.mjs can read and refuse. The dev server
// picks the first; anything `vite build` produced picks the second. Nothing
// chooses at runtime from a hostname, because a preview deploy and a local
// `npm run build` are both bundles that can escape.
//
// 'digilocker' is not implemented yet. That is deliberate and visible: the
// onboarding step renders "we can't verify you here yet" rather than waving a
// guardian through. See src/verification.js.
export const DEV_VERIFICATION_ADAPTER = 'stub';
export const VERIFICATION_ADAPTER = 'digilocker';

export const PAPERS_BUCKET = 'papers';
