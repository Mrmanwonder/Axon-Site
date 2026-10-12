-- ============================================================================
-- AXO-210: record the language the consent notice was shown in
-- ============================================================================
--
-- The DPDP Act 2023 requires the notice to be available in English or a
-- language of the Eighth Schedule, at the data principal's option. The
-- onboarding consent step offers English and Hindi again (src/notice.js), so
-- each decision must say which notice the guardian actually read, alongside
-- `notice_version`. Without it a Hindi grant and an English grant are
-- indistinguishable in the ledger.
--
-- Rows written before this column existed were all shown the English notice
-- (the React consent step rendered English only), so the default is truthful
-- for them, and it remains the value for any writer that does not send one.
--
-- consent_event stays append-only: this adds a column with a constant default,
-- which rewrites no row and fires no UPDATE trigger. The only authenticated
-- write path is the direct INSERT under `consent_event_insert_own`; that policy
-- checks scope and Parent Mode, not columns, so it needs no change. No
-- SECURITY DEFINER function writes this table.
-- ============================================================================

alter table public.consent_event
  add column if not exists notice_language text not null default 'en';

alter table public.consent_event
  drop constraint if exists consent_event_notice_language_check;

alter table public.consent_event
  add constraint consent_event_notice_language_check
  check (notice_language in ('en', 'hi'));

comment on column public.consent_event.notice_language is
  'Language of the notice shown at the moment of the decision (en or hi), as chosen by the guardian on the consent step. Read with notice_version.';
