# AXO-221: production migration version recovery

Production project: `dlgcqieyevoebefhcggi`. Read-only audit: 2026-10-09.
Base commit: `b5097f5701d5b01214cfd06a50a43c18de4c06ad`.

| Logical migration | Incorrect repository version | Actual production version |
| --- | --- | --- |
| insights_evidence_columns | 20261004090000 | 20261004071624 |
| axo_166_pipeline_fences | 20261004113432 | 20261004120241 |
| axo_166_authority_and_commit_integrity | 20261004093645 | 20261004120637 |
| axo188_original_attachment | 20261004171548 | 20261004174820 |
| syllabus_topics_and_mastery | 20261004100000 | 20261004192648 |
| consent_notice_language | 20261007090000 | 20261006184923 |
| auto_subject_by_printed_code | 20261007130000 | 20261007133240 |
| save_placed_labels_and_flagged_parts | 20261007180000 | 20261008044957 |

All eight stored production SQL bodies match their original repository bodies under SQL-token normalization. Quoted strings and identifiers are preserved; comments and unquoted formatting are ignored. Five are byte-exact after trimming. The three formatting-only differences are insights_evidence_columns, syllabus_topics_and_mastery and consent_notice_language.

## Replay dependency

The topic-tagging section in the original 20261004110000 migration creates a foreign key to syllabus_document and functions using subject_offering_syllabus and region_topic. Restoring the actual syllabus version (20261004192648) places those prerequisites later. The unchanged topic-tagging block is consolidated at the end of that syllabus file for disposable replay. Subject identity, automatic assignment, the authenticated change RPC and backfill retain their original position. The two AXO-166 migrations, school pathway, profile retry and original attachment migrations between them do not reference the deferred objects.

This is a documented replay exception, consistent with the existing historical recovery conventions. It does not rewrite the production ledger, reapply obsolete function definitions or claim unapplied work was applied. Existing BASELINE.txt entries and historical no-op/guard exceptions are unchanged.

## Planner evidence

Using the repository's pure planMigrations function and the 150-row production ledger, both the original and corrected 150-file listings produce zero pending migrations and zero unknown ledger names. Therefore the main-branch migration workflow should execute no SQL against this production project for this recovery. Clean reset and the complete SQL suite remain mandatory CI evidence; Supabase Preview must separately pass before AXO-221 closes.
