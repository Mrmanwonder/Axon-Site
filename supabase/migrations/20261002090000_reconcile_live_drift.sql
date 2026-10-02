-- ============================================================================
-- Reconcile live-only drift found by the 2026-10-02 repo-vs-production audit
-- (docs/claude_migration-ledger-2026-10-02.md). Nothing here changes behaviour
-- a user can see.
--
-- 1. public.ingest_reviewed_cbse_physics_2026_27 exists in production and in no
--    repository. It is the one-shot, service-role-only ingest of the reviewed
--    official CBSE Class XII Physics 042 2026-27 SQP/MS bundle (AXO-34/12),
--    fail-closed on hashes, counts and identity. Carried here byte-for-byte from
--    pg_get_functiondef so the repo describes production. Security invoker; only
--    service_role may execute it, as live.
--
-- 2. The mastery -> axon rename reached these three functions in the repo but
--    never the database. Production still sets and reads the transaction GUC
--    `mastery.deleting_paper` and names the tick job `mastery-tick`. Both
--    deletion functions are replaced in this one transaction, so the setter and
--    the reader never disagree. No cron job named either tick exists in
--    production, so the job-name change affects nothing scheduled.
-- ============================================================================

-- 1 --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_reviewed_cbse_physics_2026_27(p_bundle jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  b jsonb;
  v_doc public.scheme_document%rowtype;
  v_identity public.assessment_identity%rowtype;
  v_subject text;
  v_question_count integer;
  v_distinct_labels integer;
  v_covered_base integer;
  v_conflicts integer;
  v_written integer;
begin
  if jsonb_typeof(p_bundle) <> 'object' or (p_bundle->>'schemaVersion')::int <> 1 then
    raise exception 'invalid bundle envelope';
  end if;
  if jsonb_array_length(coalesce(p_bundle->'bundles','[]'::jsonb)) <> 1 then
    raise exception 'expected exactly one reviewed bundle';
  end if;

  b := p_bundle->'bundles'->0;

  if b->>'provider' <> 'cbse'
     or b->>'parserVersion' <> 'cbse-sqp-ms-v1'
     or b->>'subject' <> 'Physics'
     or b->>'sqpUrl' <> 'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-SQP.pdf'
     or b->>'msUrl' <> 'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-MS.pdf'
     or b->>'sqpSha256' <> 'ab406f5a98544cbef94c467a8e45b6471a7b206ee8ad31188eb165412f68e556'
     or b->>'msSha256' <> '7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80'
     or b#>>'{header,subjectCode}' <> '042'
     or (b#>>'{header,classLevel}')::int <> 12
     or b#>>'{header,session}' <> '2026-27'
     or (b#>>'{header,examYear}')::int <> 2027
     or (b#>>'{header,expectedQuestions}')::int <> 33
     or abs((b->>'coverage')::numeric - (30.0/33.0)) > 0.000000001
     or (b#>>'{parsed,sqpBlocks}')::int <> 39
     or (b#>>'{parsed,msBlocks}')::int <> 39
     or (b#>>'{parsed,coveredBaseQuestions}')::int <> 30
     or (b#>>'{parsed,expectedQuestions}')::int <> 33 then
    raise exception 'reviewed manifest mismatch';
  end if;

  if jsonb_typeof(b->'questions') <> 'array' then
    raise exception 'questions must be an array';
  end if;

  select count(*),
         count(distinct q.label),
         count(distinct (regexp_match(q.label, '^([0-9]{1,2})'))[1]::int)
  into v_question_count, v_distinct_labels, v_covered_base
  from jsonb_to_recordset(b->'questions')
    as q(label text, "questionText" text, "markingScheme" text, "maxMarks" integer)
  where q.label ~ '^[0-9]{1,2}(\([AB]\))?$'
    and nullif(btrim(q."questionText"), '') is not null
    and nullif(btrim(q."markingScheme"), '') is not null
    and q."maxMarks" between 1 and 5;

  if v_question_count <> 31 or v_distinct_labels <> 31 or v_covered_base <> 30 then
    raise exception 'question payload failed parser invariants: %, %, %',
      v_question_count, v_distinct_labels, v_covered_base;
  end if;

  select * into strict v_doc
  from public.scheme_document
  where id='65712f1e-1f84-449f-b802-e7b8635cdbea'::uuid
    and sha256='7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80'
    and parser_version='cbse-sqp-ms-v1'
    and source_version='2026-27:7aec844a3c6f4c4d'
    and source_url='https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-MS.pdf'
    and revoked_at is null
    and superseded_by_id is null
  for update;

  select * into strict v_identity
  from public.assessment_identity
  where id=v_doc.assessment_identity_id
    and exam_year=2027
    and session='2026-27'
    and assessment_route='sample_paper'
  for share;

  select so.display_name into strict v_subject
  from public.subject_offering so
  where so.id=v_identity.subject_offering_id
    and so.external_code='042'
    and so.availability='active';

  select count(*) into v_conflicts
  from public.canonical_question cq
  where cq.canonical_id like 'CBSE:2026-27:12:042:SQP:%'
    and (cq.assessment_identity_id is distinct from v_identity.id
      or cq.scheme_document_id is distinct from v_doc.id);

  if v_conflicts <> 0 then
    raise exception 'conflicting canonical question identity exists';
  end if;

  with rows as (
    select q.*
    from jsonb_to_recordset(b->'questions')
      as q(label text, "questionText" text, "markingScheme" text, "maxMarks" integer)
  ), upserted as (
    insert into public.canonical_question(
      board, exam_year, subject, question_text, max_marks, marking_scheme,
      scheme_source, scheme_version, syllabus_code, qualification_level, series,
      paper_number, variant, canonical_id, assessment_identity_id,
      question_label, scheme_document_id, updated_at
    )
    select
      'CBSE'::public.board,
      2027,
      v_subject,
      rows."questionText",
      rows."maxMarks"::smallint,
      rows."markingScheme",
      v_doc.source_url,
      v_doc.source_version,
      null, null, null, null, null,
      'CBSE:2026-27:12:042:SQP:' || rows.label,
      v_identity.id,
      rows.label,
      v_doc.id,
      now()
    from rows
    on conflict (canonical_id) do update set
      question_text=excluded.question_text,
      max_marks=excluded.max_marks,
      marking_scheme=excluded.marking_scheme,
      scheme_source=excluded.scheme_source,
      scheme_version=excluded.scheme_version,
      assessment_identity_id=excluded.assessment_identity_id,
      question_label=excluded.question_label,
      scheme_document_id=excluded.scheme_document_id,
      updated_at=now()
    returning 1
  )
  select count(*) into v_written from upserted;

  if v_written <> 31 then
    raise exception 'expected 31 canonical questions, wrote %', v_written;
  end if;

  update public.scheme_document
  set extraction_status='ready',
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'canonical_questions', 31,
        'production_ingest_method', 'github_oidc_reviewed_bundle',
        'production_ingest_at', now()
      )
  where id=v_doc.id;

  if (select count(*) from public.canonical_question where scheme_document_id=v_doc.id) <> 31 then
    raise exception 'post-write canonical question count mismatch';
  end if;

  return jsonb_build_object(
    'scheme_document_id', v_doc.id,
    'assessment_identity_id', v_identity.id,
    'canonical_questions', 31,
    'extraction_status', 'ready'
  );
end
$function$;

revoke all on function public.ingest_reviewed_cbse_physics_2026_27(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_reviewed_cbse_physics_2026_27(jsonb) to service_role;

-- 2 --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.enqueue_object_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row    jsonb  := to_jsonb(old);
  v_fields text[] := case tg_table_name
                       when 'paper_page'      then array['r2_key', 'mask_key', 'thumb_key', 'original_key']
                       when 'question_region' then array['crop_key', 'cropmask_key']
                       else array['r2_key']
                     end;
  v_field  text;
  v_key    text;
begin
  if coalesce(current_setting('axon.deleting_paper', true), '') = '1' then
    return old;
  end if;

  -- Read through to_jsonb rather than old.<column>: plpgsql resolves every
  -- branch of a CASE against the record, so naming question_region's columns
  -- here would break the trigger on paper_page, where they do not exist.
  foreach v_field in array v_fields loop
    v_key := v_row ->> v_field;
    if v_key is not null then
      insert into public.r2_deletion (bucket, key)
      values (case
                when v_field = 'original_key' then 'originals'
                when tg_table_name = 'upload'  then coalesce(v_row ->> 'r2_bucket', 'originals')
                else 'derived'
              end, v_key);
    end if;
  end loop;
  return old;
end; $function$
;
CREATE OR REPLACE FUNCTION private.enqueue_paper_prefix_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.r2_deletion (bucket, prefix)
  values ('originals', old.student_id || '/' || old.id || '/'),
         ('derived',   old.student_id || '/' || old.id || '/');

  -- The whole prefix is going. Child rows are about to cascade, and enqueuing
  -- their individual keys as well would be thousands of redundant DELETEs
  -- against a prefix that one walk already covers.
  perform set_config('axon.deleting_paper', '1', true);
  return old;
end; $function$
;
CREATE OR REPLACE FUNCTION private.schedule_pipeline_tick(p_functions_url text, p_service_key text, p_schedule text DEFAULT '10 seconds'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_job text := 'axon-tick';
begin
  if p_functions_url is null or p_service_key is null then
    raise exception 'both the functions URL and the service key are required';
  end if;

  perform cron.unschedule(v_job) where exists (
    select 1 from cron.job where jobname = v_job);

  perform cron.schedule(v_job, p_schedule, format(
    $job$ select net.http_post(
            url     := %L,
            headers := jsonb_build_object(
                         'Authorization', 'Bearer ' || %L,
                         'Content-Type',  'application/json'),
            body    := '{}'::jsonb,
            timeout_milliseconds := 5000) $job$,
    rtrim(p_functions_url, '/') || '/queue-tick', p_service_key));

  return v_job;
end; $function$
;
