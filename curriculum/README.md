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
- IB is keyed by official subject code and preserves SL/HL and subject group.
- These importers cover public curriculum catalogs only; restricted assessment
  papers and markschemes remain outside this pipeline unless Axon is authorized.

After review, apply the normalized diff through an additive Supabase migration or
an authenticated admin ingestion path. Upstream page changes must never silently
rewrite production student history.
