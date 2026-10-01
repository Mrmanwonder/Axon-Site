-- ============================================================================
-- Test suite: AXO-116 structure assembly and label uniqueness
-- ============================================================================
-- Reproduces the production shapes from run 89c8d7a9 with synthetic rows:
--   * pages structured out of order (3 before 2 before 1);
--   * bare part labels (a), (b) printed under more than one question;
--   * a question running across pages 1 → 2 → 3, with a teacher mark on its
--     page-3 tail;
--   * a continuation band with nothing before it (page 1).
--
-- Rolls back; safe against any database. Run from the repository root:
--
--   psql "$DATABASE_URL" -f supabase/tests/axo_116_structure_assembly.sql
--   Pass: the counts line reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11611611-1111-4111-8111-111111111111','authenticated','authenticated','g116@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('a1160000-0000-4000-8000-000000000001','11611611-1111-4111-8111-111111111111','Guardian','g116@test.invalid',now(),'stub','ref');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required and g.id = 'a1160000-0000-4000-8000-000000000001';

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('a1160000-0000-4000-8000-000000000002','a1160000-0000-4000-8000-000000000001','Test',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken) values
 ('a1160000-0000-4000-8000-000000000003','a1160000-0000-4000-8000-000000000002','unit_test','tier_1','2026-09-30');

insert into public.paper_page (paper_id, student_id, page_number, source_kind, storage_path, status, structure_status)
select 'a1160000-0000-4000-8000-000000000003','a1160000-0000-4000-8000-000000000002', n, 'upload', 'x/y/'||n||'.jpg', 'stored', 'running'
from generate_series(1,4) n;

insert into public.extraction_run (id, paper_id, student_id, pipeline_version)
values ('a1160000-0000-4000-8000-000000000010','a1160000-0000-4000-8000-000000000003','a1160000-0000-4000-8000-000000000002','1.0.0');

do $$
declare
  v_run constant uuid := 'a1160000-0000-4000-8000-000000000010';
  v_paper constant uuid := 'a1160000-0000-4000-8000-000000000003';
  v_stu constant uuid := 'a1160000-0000-4000-8000-000000000002';
  v_adv jsonb;
  v_q1 uuid; v_q2 uuid; v_cont3 uuid; v_orphan uuid;
  v_ok boolean;
  v_spans int[];
begin
  perform public.run_advance(v_run, 'triaging');
  perform public.run_advance(v_run, 'structure');

  -- ── label index: bare parts recur, numbered parts do not ─────────────────
  -- Page 4 is structured first: question 2 with parts (a), (b).
  insert into public.question_region (run_id, paper_id, student_id, order_index, page_spans, question_label, question_label_box, confidence_tier)
  values
   (v_run, v_paper, v_stu, 0, '[{"page":4,"box":{"x":10,"y":100,"w":900,"h":200}}]', '2', '{"page":4,"x":1,"y":1,"w":1,"h":1}', 'unsure'),
   (v_run, v_paper, v_stu, 1, '[{"page":4,"box":{"x":10,"y":400,"w":900,"h":200}}]', '(a)', '{"page":4,"x":1,"y":1,"w":1,"h":1}', 'unsure'),
   (v_run, v_paper, v_stu, 2, '[{"page":4,"box":{"x":10,"y":700,"w":900,"h":200}}]', '(b)', '{"page":4,"x":1,"y":1,"w":1,"h":1}', 'unsure');

  -- Page 1 next: question 1 with its own (a) and (b) — this is the insert that
  -- production rejected with 23505 and recorded as an unreadable page.
  begin
    insert into public.question_region (run_id, paper_id, student_id, order_index, page_spans, question_label, question_label_box, confidence_tier, continues_from_previous)
    values
     (v_run, v_paper, v_stu, 3, '[{"page":1,"box":{"x":10,"y":0,"w":900,"h":100}}]', null, null, 'unsure', true),
     (v_run, v_paper, v_stu, 4, '[{"page":1,"box":{"x":10,"y":200,"w":900,"h":200}}]', '1(a)', '{"page":1,"x":1,"y":1,"w":1,"h":1}', 'unsure', false),
     (v_run, v_paper, v_stu, 5, '[{"page":1,"box":{"x":10,"y":600,"w":900,"h":300}}]', '(b)', '{"page":1,"x":1,"y":1,"w":1,"h":1}', 'unsure', false);
    v_ok := true;
  exception when unique_violation then v_ok := false;
  end;
  perform public._t('bare part labels may recur within a run (was SQLSTATE 23505)', v_ok);

  begin
    insert into public.question_region (run_id, paper_id, student_id, order_index, page_spans, question_label, question_label_box, confidence_tier)
    values (v_run, v_paper, v_stu, 90, '[{"page":3,"box":{"x":1,"y":1,"w":1,"h":1}}]', '1. a)', '{"page":3,"x":1,"y":1,"w":1,"h":1}', 'unsure');
    v_ok := false;
  exception when unique_violation then v_ok := true;
  end;
  perform public._t('a numbered part is still unique per run ("1(a)" vs "1. a)")', v_ok);

  -- Page 3: the tail of 1(b) (continuation) — structured before page 2.
  insert into public.question_region (run_id, paper_id, student_id, order_index, page_spans, question_label, question_label_box, confidence_tier, continues_from_previous)
  values (v_run, v_paper, v_stu, 6, '[{"page":3,"box":{"x":10,"y":0,"w":900,"h":300}}]', null, null, 'unsure', true)
  returning id into v_cont3;
  insert into public.teacher_mark (run_id, paper_id, student_id, region_id, page_number, box, shape, mark_class, metrics, confidence_tier)
  values (v_run, v_paper, v_stu, v_cont3, 3, '{"page":3,"x":950,"y":50,"w":40,"h":40}', 'glyph', 'tick', '{}', 'unsure');

  -- Page 2: entirely the middle of 1(b) (continuation).
  insert into public.question_region (run_id, paper_id, student_id, order_index, page_spans, question_label, question_label_box, confidence_tier, continues_from_previous)
  values (v_run, v_paper, v_stu, 7, '[{"page":2,"box":{"x":10,"y":0,"w":900,"h":1000}}]', null, null, 'unsure', true);

  select id into v_q1 from public.question_region where run_id = v_run and question_label = '(b)' and page_spans->0->>'page' = '1';
  select id into v_orphan from public.question_region where run_id = v_run and order_index = 3;

  -- Page 4 is still 'running': nothing is assembled yet.
  update public.paper_page set structure_status = 'done' where paper_id = v_paper and page_number < 4;
  v_adv := public.advance_after_structure(v_run);
  perform public._t('no assembly while a page is still running',
    (v_adv->>'advanced')::boolean = false
    and (select count(*) from public.question_region where run_id = v_run and continues_from_previous) = 3);

  update public.paper_page set structure_status = 'done' where paper_id = v_paper;
  v_adv := public.advance_after_structure(v_run);
  perform public._t('the run advances once every page is settled', (v_adv->>'advanced')::boolean, v_adv::text);

  select array_agg((s->>'page')::int order by ord) into v_spans
    from public.question_region qr, jsonb_array_elements(qr.page_spans) with ordinality s(s, ord)
   where qr.id = v_q1;
  perform public._t('a question across pages 1→2→3 is assembled in page order, whatever order pages finished',
    v_spans = array[1,2,3], coalesce(v_spans::text, 'null'));

  perform public._t('merged continuation rows are gone',
    not exists (select 1 from public.question_region where id = v_cont3));

  perform public._t('the page-3 teacher mark moved with its band to the question it belongs to',
    (select region_id from public.teacher_mark where run_id = v_run and page_number = 3) = v_q1);

  perform public._t('question 2 on page 4 did not receive any continuation',
    (select jsonb_array_length(page_spans) from public.question_region where run_id = v_run and question_label = '2') = 1);

  perform public._t('a continuation with nothing before it stays its own region and is sent to review',
    (select needs_review and continues_from_previous from public.question_region where id = v_orphan));

  perform public._t('no region spans pages out of order',
    not exists (
      select 1 from public.question_region qr,
        lateral (select array_agg((s->>'page')::int order by ord) a from jsonb_array_elements(qr.page_spans) with ordinality s(s, ord)) x
      where qr.run_id = v_run and x.a <> (select array_agg(v order by v) from unnest(x.a) v)));
end $$;

do $$
begin
  perform public._t('assemble_structure is not callable by clients',
    not has_function_privilege('authenticated', 'private.assemble_structure(uuid)', 'execute')
    and not has_function_privilege('anon', 'private.assemble_structure(uuid)', 'execute'));
  perform public._t('advance_after_structure stays service-role only',
    not has_function_privilege('authenticated', 'public.advance_after_structure(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.advance_after_structure(uuid)', 'execute'));
end $$;

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
