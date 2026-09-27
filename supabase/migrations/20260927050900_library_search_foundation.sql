-- AXO-49 — verified paper subject identity + private attempt search foundation.
--
-- Subject truth comes only from an exact assessment_identity -> subject_offering
-- relationship. The legacy paper.subject string remains display-only historical
-- data and is never promoted to verified identity by this migration.
--
-- Search text stays on student_attempt, which is already Student Mode RLS
-- protected. The public RPC below is SECURITY INVOKER and therefore cannot
-- widen that row visibility.

alter table public.paper
  add column if not exists subject_offering_id uuid
    references public.subject_offering(id) on delete restrict,
  add column if not exists subject_display_snapshot text,
  add column if not exists subject_external_code_snapshot text,
  add column if not exists subject_identity_source text,
  add column if not exists subject_identity_confidence text,
  add column if not exists subject_verified_at timestamptz;

alter table public.paper
  drop constraint if exists paper_verified_subject_consistent;

alter table public.paper
  add constraint paper_verified_subject_consistent check (
    (
      subject_offering_id is null
      and subject_display_snapshot is null
      and subject_external_code_snapshot is null
      and subject_identity_source is null
      and subject_identity_confidence is null
      and subject_verified_at is null
    )
    or
    (
      subject_offering_id is not null
      and subject_display_snapshot is not null
      and subject_identity_source = 'assessment_identity'
      and subject_identity_confidence = 'verified'
      and subject_verified_at is not null
    )
  );

create index if not exists paper_student_verified_subject_idx
  on public.paper(student_id, subject_offering_id, date_taken desc)
  where subject_offering_id is not null;

comment on column public.paper.subject is
  'Legacy/unverified display subject. Never treat this free-text field as verified subject identity.';
comment on column public.paper.subject_offering_id is
  'Verified canonical subject offering derived only from paper.assessment_identity_id. Null means subject identity is unresolved.';
comment on column public.paper.subject_display_snapshot is
  'Stable display-name snapshot captured when an exact assessment identity supplies a canonical subject offering.';
comment on column public.paper.subject_external_code_snapshot is
  'Stable external-code snapshot for the verified canonical subject offering, when one exists.';
comment on column public.paper.subject_identity_source is
  'Source of verified subject identity. Currently only assessment_identity is permitted.';
comment on column public.paper.subject_identity_confidence is
  'Confidence class for canonical subject identity. verified means an exact stored assessment identity supplied it.';
comment on column public.paper.subject_verified_at is
  'Time the canonical subject snapshot was derived from an exact stored assessment identity.';

create or replace function private.sync_paper_verified_subject()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_subject_offering uuid;
  v_display_name text;
  v_external_code text;
begin
  -- assessment_identity_id is a server-authored trust decision. Student Mode
  -- may edit ordinary paper metadata, but cannot mint verified academic identity.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.assessment_identity_id is not null then
      raise exception 'assessment identity is server-authored'
        using errcode = '42501', hint = 'assessment_identity_server_authored';
    elsif tg_op = 'UPDATE'
      and new.assessment_identity_id is distinct from old.assessment_identity_id then
      raise exception 'assessment identity is server-authored'
        using errcode = '42501', hint = 'assessment_identity_server_authored';
    end if;
  end if;

  -- Canonical snapshots are never caller-authored. Recompute or clear them on
  -- every insert and every update that touches identity/snapshot fields.
  new.subject_offering_id := null;
  new.subject_display_snapshot := null;
  new.subject_external_code_snapshot := null;
  new.subject_identity_source := null;
  new.subject_identity_confidence := null;
  new.subject_verified_at := null;

  if new.assessment_identity_id is null then
    return new;
  end if;

  select ai.subject_offering_id, so.display_name, so.external_code
    into v_subject_offering, v_display_name, v_external_code
    from public.assessment_identity ai
    left join public.subject_offering so on so.id = ai.subject_offering_id
   where ai.id = new.assessment_identity_id;

  if not found then
    raise exception 'unknown assessment identity'
      using errcode = '23503';
  end if;

  -- An assessment identity may itself be subject-unresolved. Keep the paper
  -- explicitly Unknown rather than manufacturing a subject from free text.
  if v_subject_offering is null then
    return new;
  end if;

  new.subject_offering_id := v_subject_offering;
  new.subject_display_snapshot := v_display_name;
  new.subject_external_code_snapshot := v_external_code;
  new.subject_identity_source := 'assessment_identity';
  new.subject_identity_confidence := 'verified';
  new.subject_verified_at := now();
  return new;
end;
$$;

revoke all on function private.sync_paper_verified_subject() from public, anon, authenticated;

drop trigger if exists paper_sync_verified_subject on public.paper;
create trigger paper_sync_verified_subject
before insert or update of
  assessment_identity_id,
  subject_offering_id,
  subject_display_snapshot,
  subject_external_code_snapshot,
  subject_identity_source,
  subject_identity_confidence,
  subject_verified_at
on public.paper
for each row execute function private.sync_paper_verified_subject();

-- Backfill only papers that already have an exact canonical assessment identity.
-- No legacy subject string is consulted.
update public.paper p
set assessment_identity_id = p.assessment_identity_id
where p.assessment_identity_id is not null;

alter table public.student_attempt
  add column if not exists search_vector tsvector
  generated always as (
    setweight(
      pg_catalog.to_tsvector('simple'::regconfig, coalesce(question_label, '')),
      'A'
    )
    ||
    setweight(
      pg_catalog.to_tsvector('simple'::regconfig, coalesce(question_text, '')),
      'B'
    )
    ||
    setweight(
      pg_catalog.to_tsvector('simple'::regconfig, coalesce(student_answer, '')),
      'C'
    )
  ) stored;

create index if not exists student_attempt_search_vector_gin
  on public.student_attempt using gin(search_vector);

comment on column public.student_attempt.search_vector is
  'Private full-text representation of question label/text and student answer. Protected by student_attempt Student Mode RLS; never analytics/public data.';

create or replace function public.search_library_attempts(
  p_query text,
  p_limit integer default 50
)
returns table (
  paper_id uuid,
  attempt_id uuid,
  question_label text,
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with parsed as (
    select pg_catalog.websearch_to_tsquery(
      'simple'::regconfig,
      nullif(btrim(p_query), '')
    ) as query
  )
  select
    a.paper_id,
    a.id as attempt_id,
    a.question_label,
    pg_catalog.ts_rank_cd(a.search_vector, parsed.query) as rank
  from public.student_attempt a
  cross join parsed
  where parsed.query is not null
    and a.search_vector @@ parsed.query
  order by rank desc, a.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.search_library_attempts(text, integer) from public, anon;
grant execute on function public.search_library_attempts(text, integer) to authenticated;

comment on function public.search_library_attempts(text, integer) is
  'Student-Mode-scoped private attempt-text search. SECURITY INVOKER intentionally relies on student_attempt RLS and returns no raw answer/question snippets.';
