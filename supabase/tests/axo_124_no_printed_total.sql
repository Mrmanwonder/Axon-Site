-- ============================================================================
-- Test suite: AXO-124 papers with no printed total
-- ============================================================================
--   · a committed paper that printed no total is labelled added_up; one that did is printed
--   · an unreadable mark makes the added-up total partial
--   · the student's own role can write the new total columns (commit runs as the student)
--   · paper_progress exposes reconciled and the machine reason
-- Rolls back; safe against any database.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now());
insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a');
insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');

-- Paper 1: no printed total, every mark read. Paper 2: no printed total, one mark unreadable.
-- Paper 3: a printed total.
insert into public.paper (id, student_id, type, tier, date_taken, subject, reported_total) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics', null),
 ('aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics', null),
 ('aaaaaaaa-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-03','Physics', 10);

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled, status_reason_code) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', null, 'no_printed_total'),
 ('aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', null, 'no_printed_total'),
 ('aaaaaaaa-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', true, null);

create or replace function public._region(p_id uuid, p_run uuid, p_paper uuid, p_order int,
                                          p_awarded numeric, p_available numeric, p_tier text default 'confident')
returns void language plpgsql as $$
begin
  insert into public.question_region (id, run_id, paper_id, student_id, order_index,
      question_label, question_label_box,
      marks_awarded, marks_awarded_box, marks_available, marks_available_box,
      confidence_tier, needs_review, student_confirmed_at)
  values (p_id, p_run, p_paper, 'aaaaaaaa-0000-4000-8000-000000000002', p_order,
      'Q' || (p_order + 1), '{"page":1,"x":3,"y":3,"w":1,"h":1}',
      p_awarded, case when p_awarded is not null then '{"page":1,"x":1,"y":1,"w":1,"h":1}'::jsonb end,
      p_available, case when p_available is not null then '{"page":1,"x":2,"y":2,"w":1,"h":1}'::jsonb end,
      p_tier::public.confidence_tier, false, now());
end $$;

select public._region('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1', 0, 4, 5);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1', 1, 3, 5);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 0, 4, 5);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c4','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 1, null, null, 'unreadable');
select public._region('aaaaaaaa-0000-4000-8000-0000000000c5','aaaaaaaa-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-0000000000a3', 0, 6, 10);

select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b1');
select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b2');
select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b3');

select public._t('no printed total, every mark read: the total is added up by Axon and complete',
  (select total_basis = 'added_up' and total_partial = false and total_awarded = 7 and total_available = 10
     from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  (select total_basis || '/' || total_partial::text || '/' || total_awarded::text from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'));

select public._t('no printed total, one mark unreadable: the added-up total is partial (at least)',
  (select total_basis = 'added_up' and total_partial = true and total_awarded = 4
     from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a2'),
  (select total_basis || '/' || total_partial::text || '/' || total_awarded::text from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a2'));

select public._t('a printed total is labelled printed, not partial',
  (select total_basis = 'printed' and total_partial = false from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a3'));

select public._t('the student''s own role may write the new total columns (commit runs as the student)',
  has_column_privilege('authenticated', 'public.paper', 'total_basis', 'UPDATE')
  and has_column_privilege('authenticated', 'public.paper', 'total_partial', 'UPDATE'));

select public._t('paper_progress exposes reconciled (null = unchecked) and the machine reason',
  (select reconciled is null and status_reason_code = 'no_printed_total'
     from public.paper_progress where run_id = 'aaaaaaaa-0000-4000-8000-0000000000b1'));

select public._t('the machine reason must be a lower-snake code',
  (select count(*) = 1 from pg_constraint where conname = 'status_reason_code_is_a_code'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
