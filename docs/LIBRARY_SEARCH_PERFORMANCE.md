# Library Search Performance Contract

AXO-52 closes the performance and resource-state acceptance for the private Library search shipped by AXO-49/50/51.

## Production-like fixture

The executable SQL benchmark is `supabase/tests/library_search_benchmark.sql`. It runs inside a rollback-only transaction and creates:

- 500 papers and 5,000 marked attempts for the active student;
- 100 papers and 1,000 attempts for a sibling under the same guardian;
- long extracted answers, common terms, a unique rare term, and special-symbol text;
- a selective verified canonical-subject subset plus legacy suggested-subject papers;
- real consent, Pro multi-profile entitlement, signed-session claims and Student Mode scope.

The sibling corpus intentionally contains the common search vocabulary so RLS/Student Mode remains part of the measured query shape rather than a separate toy benchmark.

## Latency budget

The suite warms each query family three times, then records 20 samples for:

1. common answer text;
2. rare answer text;
3. verified canonical-subject filtering;
4. combined paper-type/tier/date filtering.

Acceptance is **p95 <= 250 ms for every family** on the local/staging Supabase CI fixture. With the UI's 180 ms debounce, that keeps the normal warm search response inside an approximately 0.5 second interaction budget without hiding latency behind false empty states.

The SQL suite prints p50, p95 and max latency for every family so regressions have concrete evidence instead of a pass/fail label alone.

## Planner evidence

The benchmark runs `ANALYZE` after loading the fixture and captures `EXPLAIN (FORMAT JSON)`. Acceptance requires:

- `student_attempt_search_vector_gin` for private question/answer full-text lookup;
- `paper_student_verified_subject_idx` for selective active-student canonical-subject filtering.

## Index freshness

`student_attempt.search_vector` is a PostgreSQL **generated stored column**. It changes in the same transaction as `question_text`, `question_label` or `student_answer`; there is no asynchronous indexing queue and therefore no honest separate "indexing…" product state to expose.

The benchmark updates an answer with a new unique token and immediately searches for it under Student Mode. The test must find the paper without a delay or reconciliation job.

Network/cache staleness is handled separately by the Library UI: a new request keeps the last-good result list visible under `Searching…`, and a failed request keeps last-good results plus an explicit retry message rather than pretending the query returned zero matches.

## Running

The normal repository CI runs the SQL suite as part of `supabase/tests/*.sql`, alongside the UI, browser, accessibility and production-build checks. No production data is copied into the benchmark.
