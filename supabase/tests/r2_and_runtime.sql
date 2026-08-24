-- ============================================================================
-- Test suite: R2 keys, deletion, and the queue runtime
-- ============================================================================
-- What migration 0013 claims and this checks: that an object key cannot be half
-- recorded, that deleting a row enqueues the bytes for real deletion by every
-- path including account erasure, that a stopped run always carries a reason,
-- and that the cost ledger and the routing table are invisible to students.
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/r2_and_runtime.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','gb@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a'),
 ('bbbbbbbb-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Guardian B','b@test.invalid',now(),'stub','ref-b');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18'),
 ('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000001','Bora',12,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics'),
 ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics');

insert into public.paper_page (id, paper_id, student_id, page_number, source_kind, status,
                               r2_bucket, r2_key, mask_key, original_key, preprocess_version)
values ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000003',
        'aaaaaaaa-0000-4000-8000-000000000002',1,'upload','stored','derived',
        'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000003/page/1-Zm9vYmFyYmF6cXV4Cg.webp',
        'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000003/mask/1-Zm9vYmFyYmF6cXV4Cg.png',
        'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000003/raw/1-Zm9vYmFyYmF6cXV4Cg.heic',
        'v2');

-- ── an object key is whole or absent ───────────────────────────────────────
-- A bucket with no key names nothing, and a key with no bucket is a key we
-- cannot go and fetch. Either half alone is a row that looks like storage.

do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, status, r2_bucket)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
          90,'upload','pending','derived');
  perform public._t('a bucket with no key is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('a bucket with no key is refused', true);
end; end $$;

do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, status, r2_bucket, r2_key)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
          91,'upload','pending','public-cdn','x');
  perform public._t('an unknown bucket name is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('an unknown bucket name is refused', true);
end; end $$;

-- An upload page still has to say where its bytes are; the rule survived the
-- move from Supabase Storage to R2 rather than being dropped with the column.
do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, status)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
          92,'upload','pending');
  perform public._t('an upload page with no bytes anywhere is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('an upload page with no bytes anywhere is refused', true);
end; end $$;

do $$ begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, status, storage_path)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
          93,'upload','stored','legacy/path.jpg');
  perform public._t('a page still in Supabase Storage is accepted', true);
exception when others then
  perform public._t('a page still in Supabase Storage is accepted', false, sqlerrm);
end $$;
delete from public.paper_page where page_number = 93;

-- ── an upload is confirmed by us, not by the device ────────────────────────

do $$ begin begin
  insert into public.upload (paper_id, student_id, kind, r2_key, content_type, confirmed)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
          'pdf','k1','application/pdf', true);
  perform public._t('an upload cannot be confirmed without a measured size', false, 'insert succeeded');
exception when check_violation then
  perform public._t('an upload cannot be confirmed without a measured size', true);
end; end $$;

do $$ begin begin
  insert into public.upload (paper_id, student_id, kind, r2_key, content_type)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
          'docx','k2','application/msword');
  perform public._t('an upload kind outside pdf/image is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('an upload kind outside pdf/image is refused', true);
end; end $$;

-- ── deletion is real ───────────────────────────────────────────────────────

do $$
declare v_before bigint; v_after bigint;
begin
  select count(*) into v_before from public.r2_deletion;
  delete from public.paper_page where id = 'aaaaaaaa-0000-4000-8000-000000000004';
  select count(*) into v_after from public.r2_deletion where key is not null;
  perform public._t('deleting a page enqueues its page, mask and original', v_after = 3,
                    format('enqueued %s keys', v_after));
  perform public._t('the original is enqueued against the originals bucket',
                    exists (select 1 from public.r2_deletion
                            where bucket = 'originals' and key like '%/raw/%'));
  perform public._t('the mask is enqueued against the derived bucket',
                    exists (select 1 from public.r2_deletion
                            where bucket = 'derived' and key like '%/mask/%'));
end $$;
delete from public.r2_deletion;

do $$
declare v_prefixes bigint; v_keys bigint;
begin
  delete from public.paper where id = 'aaaaaaaa-0000-4000-8000-000000000003';
  select count(*) into v_prefixes from public.r2_deletion where prefix is not null;
  select count(*) into v_keys     from public.r2_deletion where key    is not null;
  perform public._t('deleting a paper enqueues both bucket prefixes', v_prefixes = 2,
                    format('%s prefixes', v_prefixes));
  -- The prefix walk covers every child object. Enqueuing each cascaded row's
  -- keys as well would be thousands of redundant DELETEs against a prefix one
  -- walk already handles.
  perform public._t('a paper delete does not also enqueue every child key', v_keys = 0,
                    format('%s stray keys', v_keys));
end $$;
delete from public.r2_deletion;

do $$ begin begin
  insert into public.r2_deletion (bucket, prefix, key) values ('derived', 'p/', 'k');
  perform public._t('a deletion naming both a prefix and a key is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('a deletion naming both a prefix and a key is refused', true);
end; end $$;

-- Account erasure is the same walk with a shorter prefix.
do $$
declare v_prefixes bigint;
begin
  update public.student set deleted_at = now()
   where id = 'bbbbbbbb-0000-4000-8000-000000000002';
  select count(*) into v_prefixes from public.r2_deletion
   where prefix = 'bbbbbbbb-0000-4000-8000-000000000002/';
  perform public._t('erasing a student enqueues their whole prefix in both buckets',
                    v_prefixes = 2, format('%s prefixes', v_prefixes));
end $$;
delete from public.r2_deletion;

-- ── a stopped run says why ─────────────────────────────────────────────────
-- Hard rule 4. A run that stopped without a reason is the invisible failure.

insert into public.extraction_run (id, paper_id, student_id, pipeline_version)
values ('aaaaaaaa-0000-4000-8000-000000000011','bbbbbbbb-0000-4000-8000-000000000003',
        'bbbbbbbb-0000-4000-8000-000000000002','1.0.0');

do $$ begin begin
  update public.extraction_run set status = 'rejected'
   where id = 'aaaaaaaa-0000-4000-8000-000000000011';
  perform public._t('a rejected run with no reason is refused', false, 'update succeeded');
exception when check_violation then
  perform public._t('a rejected run with no reason is refused', true);
end; end $$;

do $$ begin
  update public.extraction_run
     set status = 'rejected', status_reason = 'This does not look like a graded exam paper.'
   where id = 'aaaaaaaa-0000-4000-8000-000000000011';
  perform public._t('a rejected run with a reason is accepted', true);
exception when others then
  perform public._t('a rejected run with a reason is accepted', false, sqlerrm);
end $$;

-- ── the sweeps ─────────────────────────────────────────────────────────────

do $$
declare v_swept integer;
begin
  update public.extraction_run
     set status = 'content', status_reason = null,
         started_at = now() - interval '1 hour', heartbeat_at = null
   where id = 'aaaaaaaa-0000-4000-8000-000000000011';

  select private.sweep_stuck_runs() into v_swept;
  perform public._t('a run whose worker stopped heartbeating is failed', v_swept >= 1,
                    format('%s swept', v_swept));
  perform public._t('and the failure is worded for the student',
                    (select status_reason from public.extraction_run
                      where id = 'aaaaaaaa-0000-4000-8000-000000000011') like '%try again%');
end $$;

do $$
declare v_swept integer;
begin
  -- A run waiting on the student is not a stalled run, however long it waits.
  update public.extraction_run
     set status = 'needs_review', status_reason = null,
         started_at = now() - interval '9 days', heartbeat_at = now() - interval '9 days'
   where id = 'aaaaaaaa-0000-4000-8000-000000000011';
  select private.sweep_stuck_runs() into v_swept;
  perform public._t('a run waiting on the student is never swept', v_swept = 0,
                    format('%s swept', v_swept));
end $$;

-- ── the queues exist ───────────────────────────────────────────────────────

do $$
declare v_missing text[];
begin
  select array_agg(q) into v_missing from unnest(array[
    'mastery_triage','mastery_structure','mastery_content',
    'mastery_adjudicate','mastery_explain','mastery_r2_delete']) q
  where not exists (select 1 from pgmq.list_queues() lq where lq.queue_name = q);
  perform public._t('every queue the dispatcher reads exists', v_missing is null,
                    coalesce(array_to_string(v_missing, ', '), ''));
end $$;

-- ── the routes ─────────────────────────────────────────────────────────────

do $$
declare v_stages integer; v_training integer;
begin
  select count(*) into v_stages from public.model_route;
  perform public._t('every stage has a route', v_stages = 5, format('%s routes', v_stages));

  select count(*) into v_training from public.model_route where allow_training;
  -- Nothing in the codebase writes this column. A route that needs it is a route
  -- whose provider may keep the page, and the page is a named minor's script.
  perform public._t('no seeded route relaxes the retention policy', v_training = 0,
                    format('%s routes allow training', v_training));
end $$;

do $$ begin begin
  insert into public.model_route (stage, primary_model, prompt_version)
  values ('summarise', 'x', 'v1');
  perform public._t('a route for a stage that does not exist is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('a route for a stage that does not exist is refused', true);
end; end $$;

-- ── the ledger ─────────────────────────────────────────────────────────────

do $$ begin begin
  insert into public.model_call (stage, requested_model, model_id, prompt_version, ok)
  values ('content', 'a', 'b', 'content.v1', false);
  perform public._t('a failed call with no error code is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('a failed call with no error code is refused', true);
end; end $$;

-- ── what a student can see ─────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

do $$
declare v_n bigint;
begin
  select count(*) into v_n from public.model_call;
  perform public._t('a student cannot read the cost ledger', v_n = 0, format('%s rows visible', v_n));
exception when insufficient_privilege then
  perform public._t('a student cannot read the cost ledger', true);
end $$;

do $$
declare v_n bigint;
begin
  select count(*) into v_n from public.model_route;
  perform public._t('a student cannot read which models we use', v_n = 0, format('%s rows visible', v_n));
exception when insufficient_privilege then
  perform public._t('a student cannot read which models we use', true);
end $$;

do $$
declare v_n bigint;
begin
  select count(*) into v_n from public.r2_deletion;
  perform public._t('a student cannot read the deletion queue', v_n = 0, format('%s rows visible', v_n));
exception when insufficient_privilege then
  perform public._t('a student cannot read the deletion queue', true);
end $$;

do $$
declare v_n bigint;
begin
  select count(*) into v_n from public.upload
   where student_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  perform public._t('a student cannot read another student''s uploads', v_n = 0,
                    format('%s rows visible', v_n));
exception when insufficient_privilege then
  perform public._t('a student cannot read another student''s uploads', true);
end $$;

reset role;

-- ── results ────────────────────────────────────────────────────────────────

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
