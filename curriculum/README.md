# Curriculum source importers

Axon's runtime curriculum catalog lives in Supabase. The files in `curriculum/fixtures/`
are the diffable normalized review baseline. They keep catalog changes auditable and
ensure onboarding never scrapes an awarding-body site.

## Commands

- `npm run curriculum:validate` validates the committed normalized fixtures.
- `npm run curriculum:check` downloads the current first-party sources, parses them
  with versioned adapters, and reports additions, removals and changed identities.
- `node scripts/curriculum/catalog.mjs snapshot` writes source-derived candidates
  under `curriculum/generated/` for human review before activation.

The IB adapter uses `pdftotext -layout` from Poppler. This preserves the official
PDF's SL/HL column positions instead of guessing level from subject names.

IBO currently returns HTTP 403 to GitHub-hosted automation for the canonical PDF.
Axon respects that response: CI validates the committed IB fixture and parser but
never bypasses the provider's access controls. For an authorized admin drift check,
download the official PDF normally from the source URL and run:

`AXON_IB_CATALOG_PDF=/path/to/all-dp-subjects-list-en.pdf npm run curriculum:check`

The supplied bytes are hashed and compared through the same normalized adapter.

## Activation rules

- Never activate a source diff automatically.
- Never delete an offering attached to a student; mark it retired.
- Preserve source URL, source version, content SHA-256 and parser version.
- Cambridge is keyed by exact syllabus code.
- CBSE is scoped by stage and preserves official subject codes where surfaced.
- IB preserves official subject code, SL/HL and subject group, but the official
  "All DP subjects" PDF is an identity/transcript registry, not an active-only
  picker source. It explicitly includes historic/discontinued courses.
- The IB discontinued appendix is status evidence, not an automatic delete/retire
  instruction. A retirement candidate must match both official code and normalized
  subject identity; code-only matches are rejected because IB can reuse/repurpose
  codes. Conflicts are emitted as manual-review metadata while the offering remains
  unchanged until a current-status source resolves them.
- Current school-based syllabus pages and current examiner instructions are reviewed
  alongside the registry when status is ambiguous; no upstream contradiction may
  silently rewrite student history.
- These importers cover public curriculum catalogs only; restricted assessment
  papers and markschemes remain outside this pipeline unless Axon is authorized.

After review, apply the normalized diff through an additive Supabase migration or
an authenticated admin ingestion path. Upstream page changes must never silently
rewrite production student history.
