# Frontend remediation validation

Validated locally on 2026-09-22 against the working tree based on `bd5729a`.
The changes are uncommitted. This report does not attest to a deployed revision.

## Implementation

| Specification | Implementation and evidence |
| --- | --- |
| FE-001–007: resource truth | `useResource` separates loading, live/cache success, and failure with retained data. AppProvider, Library, Home, Insights, and Settings consume these states. Resource interaction and browser tests cover delayed reads, failure, and stale data. |
| FE-008–013: scanner lifecycle | ScanProvider owns route activation; scanner initialization and surface attachment are separate. Activation checks stop late camera results and failed startup attempts. Lifecycle tests cover exit, retry, provider rerenders, upload-first initialization, and completion after navigation. |
| FE-014–018: durable mutations | Submission and profile creation are single-flight. Stable request identities and invoker-rights SQL functions make profile/subjects and paper/link creation atomic and retryable. Interaction tests exercise ten rapid actions; PGlite verifies transaction rollback, ownership, and idempotent retries. |
| FE-019–025: navigation | React Router owns review and sheet locations. The obsolete history hook is removed; route exceptions and unknown URLs have different recovery UI. Save targets the committed paper. Dialog callback navigation and runtime-error behavior have browser coverage. |
| FE-026–030: paper presentation and ingestion | Home and Library share `paperPresentation`. Status failures remain explicit. Uploads return accepted/rejected results, navigate to Scan when pages are accepted, and advertise only supported image types. |
| FE-031–035: local data and offline | LocalDataService owns cache/draft handles, cross-tab purge, invalidation, and retention. Browser tests cover deletion, late writes, sibling-tab cleanup, and expiration. The production-build test loads Library and a paper through the real readers with mocked server responses, disables the network, then reloads and verifies readable cached content and its offline label. |
| FE-036–039: mutation ordering | Preferences and avatars serialize writes. Pending preference patches remain visible until settled, with failure rollback. Interaction tests verify rapid edits cannot restore an older choice. |
| FE-040–044: settings and profiles | Reasoning preference has a consumer; unavailable notifications and export limitations are explicit. Unsupported subject-management copy is removed. Guardian-controlled profile selection persists an `active_student_id` per guardian on this device. |
| FE-045–054: accessibility | Shared native dialog, labelled inputs, closed-review unmounting, route-level review focus, native mark radios, answer descriptions, reduced-motion springs, scoped gestures, route focus/titles, skip link, and delayed loading states. Browser checks cover Chromium and mobile WebKit; axe runs in both. |

## Additional failure cases fixed in this continuation

- Failed scanner initialization invalidates pending camera startup before allowing retry.
- Save clears its displayed busy state independently of whether a subsequent review read succeeds.
- A profile reset during explanations prevents the old save from committing or navigating the next profile.
- A profile reset during review re-entry prevents old regions/review state from being restored.
- Pending review refresh timers are cleared when scanner context resets; background refresh failures are surfaced.

## Local verification

| Check | Result |
| --- | --- |
| `npm test` | 196 passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; existing large-chunk warning remains |
| `npm run test:ui` | 26 passed |
| `npm run test:db` | 1 transaction suite passed |
| `npm run test:e2e` | 43 passed, 1 intentional skip |
| `npm run test:a11y` | 10 passed |
| `git diff --check` | Passed |

CI includes the frontend gates, Chromium, and mobile WebKit. Timing and mutation
regressions use both component/module interactions and browser tests; the full
production extraction service is not invoked by these fixtures.

## Release requirements and limits

- Apply and verify `supabase/migrations/20260912040233_frontend_atomic_mutations.sql`
  before releasing the frontend that calls its new functions. This session did
  not modify the live database or deploy the site.
- The local database check uses PGlite. Full Supabase schema checks are configured
  in CI and were not executed against a local Supabase stack in this session.
- Playwright's service-worker inspection test intentionally skips WebKit. The
  remaining browser tests include mobile WebKit, which is not physical-iPhone
  verification.
- Browser data is mocked. The checks establish frontend behavior, not production
  credentials, extraction quality, or live backend availability.
