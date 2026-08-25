// Client configuration.
//
// The publishable key is designed to ship inside the client — it carries no
// authority of its own. Every table has RLS with no policy for `anon`, so this
// key on its own reaches nothing; it is the signed-in session that grants
// access. Committing it is intended, not an oversight.

export const SUPABASE_URL = 'https://dlgcqieyevoebefhcggi.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WZCc08bBepIIIgdsuiuYCA_5isUL0ED';

// The Cloudflare Workers pipeline. CLOUDFLARE_WORKERS.md / workers/README.md.
// mastery-api is the one worker the client ever talks to directly — it mints
// R2 presigned uploads, files the paper, and starts explanations after
// review. Everything past that (triage through explain) is queue-driven and
// the client never calls it: progress comes from reading extraction_run and
// question_region through Supabase, the same RLS-scoped session either way.
export const MASTERY_API_URL = 'https://mastery-api.tanmay-harkawat.workers.dev';

// Version of the consent notice text currently shown in the UI. Bump this
// whenever the wording or the set of purposes changes: every consent_event
// records it, so a historical decision stays tied to what was actually agreed.
// A change here means returning guardians are asked to consent again.
export const CONSENT_NOTICE_VERSION = '1.0.0';

// Which guardian-verification adapter to use. 'stub' for development;
// 'digilocker' is the intended production adapter.
export const VERIFICATION_ADAPTER = 'stub';

export const PAPERS_BUCKET = 'papers';
