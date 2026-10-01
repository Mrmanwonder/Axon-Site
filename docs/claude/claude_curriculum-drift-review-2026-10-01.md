# Curriculum source drift review — 2026-10-01 (AXO-26)

Scope: Cambridge, CBSE and IBDP, against official first-party sources, using the repository's own versioned importers (`scripts/curriculum/catalog.mjs`). No protected marking-scheme text is read, copied or stored; this concerns subject/syllabus **identity** catalogues only. **Nothing was approved automatically and nothing was written to production.**

## Method

1. Listed open PRs on Axon-Site: none touches `curriculum/**` or `scripts/curriculum/**`, and no open drift-report PR exists. (Open PRs #162, #165, #166, #168, #169 are other workstreams.)
2. `npm run curriculum:check` — fetches the live first-party pages, parses them with the adapters, compares active identities with `curriculum/fixtures/*.json`.
3. `node scripts/curriculum/catalog.mjs snapshot` — recorded source URL, version, parser and SHA-256 per fetched document (below). The generated files are git-ignored and are not committed.
4. Compared the fixtures with live production (`public.subject_offering`, read-only SQL).

## Result and decisions

| Provider | Official source (URL / version / parser) | Live SHA-256 (first 12) | Drift vs fixture | Production parity | Decision |
|---|---|---|---|---|---|
| Cambridge IGCSE | cambridgeinternational.org …/cambridge-igcse/subjects/ · `2026-live` · `cambridge-html-v1` | `02e31850469b` | none (added 0 / removed 0 / changed 0) | — | Nothing to approve |
| Cambridge AS & A Level | cambridgeinternational.org …/cambridge-international-as-and-a-levels/subjects/ · `2026-live` · `cambridge-html-v1` | `5dbdec69d7b1` | none | 308 active / 16 retired = fixture (308 / 16) | Nothing to approve |
| CBSE curriculum | cbseacademic.nic.in/curriculum_2027.html · `2026-27` · `cbse-html-v1` | `9f96b807771b` | none | 386 active / 38 retired = fixture (386 / 38) | Nothing to approve |
| CBSE skill | cbseacademic.nic.in/skill-education-curriculum.html · `2026-27` · `cbse-html-v1` | `4737cd8613d6` | none | (included above) | Nothing to approve |
| IB Diploma | ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf (version `2026` per fixture) | **not fetched** | **not checked** | 356 active (178 identities × DP1/DP2) = fixture 356 | **BLOCKED-ON-HUMAN** |

Notes that matter when reading the numbers
- The report prints `source=308 fixture=324` for Cambridge and `source=376 fixture=424` for CBSE and still says "no drift". That is expected: the comparator only diffs **active** identities. Cambridge's fixture carries 16 retired rows (324 = 308 + 16). CBSE's fixture carries 38 retired rows and 10 manually-reconciled internal-assessment rows that the first-party HTML does not list as normal entries and that the comparator deliberately excludes (424 = 386 + 38; 376 = 386 − 10).
- Retired rows are retained, never deleted, so historical student identity is preserved (matches the README activation rules and the issue's acceptance).
- Per-document SHAs are recorded here as the retrieval record. The committed fixtures do not store document-level hashes (IB offerings carry `source_sha256: null`), so a SHA change without catalog drift (page edited, same subject list) is invisible to the current check; see recommendation.

## BLOCKED-ON-HUMAN: IB Diploma source

IBO returns HTTP 403 to automation for the canonical PDF and Axon respects that, so IB drift can only be checked with a file an authorised person downloads normally.
Exact ask: download the official "All DP subjects" PDF from the URL above (recorded as `source_url` in `curriculum/fixtures/ib.json`), then run
`AXON_IB_CATALOG_PDF=/path/to/all-dp-subjects-list-en.pdf npm run curriculum:check`
and paste the output (and the file's SHA-256) into AXO-26. Until then the last review stands: 178 identities / 356 offerings match production; the main-table vs discontinued-appendix contradiction (AXO-93) remains unretired because no code-level retirement is safe.

## Rejected / suspicious items

None this cycle. A suspicious-drift rule is already encoded (code-only IB retirements are rejected; Cambridge keyed by exact syllabus code); nothing triggered it.

## Recommendations (not done here)

1. Persist per-document `sha256`/`version`/`parser` in the weekly drift artifact so "page changed, catalog identical" is visible (cheap, and it is what the AXO-26 acceptance "record source hash/version/retrieval metadata" asks for on every review, not only on activation).
2. The weekly workflow (`curriculum-drift.yml`, Mondays 04:17 UTC) uploads a text report only. Posting a one-line summary to AXO-26 only when the report differs from the previous run belongs in the nightly audit (see `claude_audit-runbook-2026-10-01.md`).

## AXO-26 status

Stays **In Progress**: it is a recurring operational issue. This cycle's Cambridge and CBSE review is complete and evidenced; IB is blocked on a human-supplied PDF.
