# Scoped syllabus retrieval (AXO-226)

This is the database boundary for the new retrieval path, not a replacement for
the current topic worker. No production source approvals are seeded. A verified
document and a licensed/authorized use are separate decisions.

## Server contract

1. Authenticate the caller and load their paper in the backend. Never forward a
   model-supplied paper ID, document ID, source hash or student ID.
2. Call `resolve_syllabus_retrieval_scope(p_paper_id)` using server credentials.
   An unavailable scope must not interrupt extraction or become a poor-mastery
   judgment. Persist the reason in the future matching job's state.
3. Pin the returned document ID and SHA-256 for the paper's matching job. Pass
   these server-owned values to `search_syllabus_topics` with query text only
   from the printed question or a bounded model refinement.
4. Set a database/request timeout and bound concurrent requests in the adapter.
   The database limits query size to 512 bytes and top-k to 1-20 (default 12).
   Results include at most 2,000 objective characters, 300 title characters and
   100 code characters per candidate plus one same-document parent. A truncated
   objective is explicitly flagged; do not treat it as the complete source.
5. Treat the shortlist as candidates, never as a topic assignment. Return
   unavailable/no-match rather than inventing an objective. The current lexical
   path uses the `simple` dictionary and exact code lookup. It does not yet solve
   semantic, formula, bilingual or cross-part recall.

The resolver requires a verified paper subject and known exam year. It uses
`exam_date` or the bound assessment identity's `exam_year`, never `date_taken`.
Conflicting years, unknown levels and overlapping verified document versions
abstain. Assessment document versions describe assessments, so they are not
silently reused as syllabus versions. The approval binds offering, programme,
stage, code, assessment level, qualification scopes, source URL, hash, version
and validity. Each search rechecks this binding.

## Source approval

`private.syllabus_retrieval_approval` is writable only by a database operator.
The runtime has read access. Browser roles have neither table access nor RPC
execution. An operator must record a real rights basis, approval reference and
reviewer for the exact verified document and allowed qualification scopes.
`''` in the scopes explicitly admits objectives without a qualification label.
No AS/A or SL/HL inclusion is inferred automatically.

Parsed topic mutations and relevant document updates revoke the approval.
Restoring the old content does not automatically restore it. Source approvals
contain no student queries. The RPC does not write any queries, results or
student content to shared tables or logs. Infrastructure query logging must
also remain disabled/redacted before using this path with student content.

## Release gates still outstanding

The backend adapter, per-paper concurrency limit and timeout, bounded refinement
round, partial batch validation/retry, revision-fenced persistence, invalidation
of existing tags, and feature flag must be implemented before rollout. Existing
`syllabus_for_paper`, claim/finish RPCs and production model prompts are unchanged
by this foundation. Their permissive behavior is not fixed by merely adding
these new RPCs.

Run `supabase/tests/axo_226_scoped_syllabus_retrieval.sql` against the complete
schema. Its synthetic fixtures test authority and safety, not model quality.
Before enabling matching, compare the full-corpus baseline, lexical shortlist
and selective refinement on the same human-labeled papers. Measure recall@k,
false tags, per-question recovery, p95 latency and total cost per correctly
completed paper. Real source approval and measured quality remain required.
