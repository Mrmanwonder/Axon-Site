begin;

create table public._share_r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._share_r to authenticated, anon;
grant usage, select on sequence public._share_r_seq_seq to authenticated, anon;
create or replace function public._share_t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._share_r(name,passed,detail) values(n,p,d); $$;
grant execute on function public._share_t(text,boolean,text) to authenticated, anon;

create or replace function public._share_claims(p_sub text, p_age interval)
returns text language sql as $$
  select jsonb_build_object(
    'sub', p_sub, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object(
      'method','otp',
      'timestamp',floor(extract(epoch from (now() - p_age)))::bigint
    ))
  )::text;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','89000000-0000-4000-8000-000000000001','authenticated','authenticated','share-a@test.invalid','x',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','89000000-0000-4000-8000-000000000002','authenticated','authenticated','share-b@test.invalid','x',now(),now(),now());

insert into public.guardian(id,auth_user_id,name,contact) values
('89000000-0000-4000-8000-000000000011','89000000-0000-4000-8000-000000000001','Guardian A','private-a@test.invalid'),
('89000000-0000-4000-8000-000000000012','89000000-0000-4000-8000-000000000002','Guardian B','private-b@test.invalid');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.guardian_id::uuid, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from (values
  ('89000000-0000-4000-8000-000000000011'),
  ('89000000-0000-4000-8000-000000000012')
) as g(guardian_id)
cross join public.consent_purpose cp
where cp.is_required;

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp
where cp.is_required;

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
('89000000-0000-4000-8000-000000000021','89000000-0000-4000-8000-000000000011','Student Secret A',10,'under_18'),
('89000000-0000-4000-8000-000000000022','89000000-0000-4000-8000-000000000012','Student Secret B',10,'under_18');

insert into public.paper(
  id,student_id,type,tier,date_taken,subject,total_awarded,total_available,reconciled
) values
('89000000-0000-4000-8000-000000000031','89000000-0000-4000-8000-000000000021','unit_test','tier_1',current_date,'Physics',2,3,true),
('89000000-0000-4000-8000-000000000032','89000000-0000-4000-8000-000000000022','unit_test','tier_1',current_date,'Chemistry',1,2,true);

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,teacher_remark,extraction_confidence
) values
('89000000-0000-4000-8000-000000000041','89000000-0000-4000-8000-000000000021','89000000-0000-4000-8000-000000000031','tier_1','Q1','What is two?','Two',2,3,'teacher_pen','Good setup','confirmed'),
('89000000-0000-4000-8000-000000000042','89000000-0000-4000-8000-000000000022','89000000-0000-4000-8000-000000000032','tier_1','Q9','Private sibling question','Private sibling answer',1,2,'teacher_pen',null,'confirmed');

-- ── creation is a guardian/Parent Mode operation ───────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', public._share_claims('89000000-0000-4000-8000-000000000001', interval '4 hours'), true);

do $$ begin
  perform public.create_academic_share('paper','89000000-0000-4000-8000-000000000031',1440);
  perform public._share_t('stale Parent Mode cannot create a share', false, 'share creation succeeded');
exception when insufficient_privilege then
  perform public._share_t('stale Parent Mode cannot create a share', true);
when others then
  perform public._share_t('stale Parent Mode cannot create a share', false, sqlerrm);
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._share_claims('89000000-0000-4000-8000-000000000002', interval '5 seconds'), true);

do $$ begin
  perform public.create_academic_share('paper','89000000-0000-4000-8000-000000000031',1440);
  perform public._share_t('another guardian cannot share this paper', false, 'share creation succeeded');
exception when others then
  perform public._share_t('another guardian cannot share this paper', sqlstate='P0002', sqlerrm);
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._share_claims('89000000-0000-4000-8000-000000000001', interval '5 seconds'), true);

do $$
declare
  first_created jsonb;
  created jsonb;
  active jsonb;
  token text;
  first_share_id uuid;
  share_id uuid;
begin
  first_created := public.create_academic_share('paper','89000000-0000-4000-8000-000000000031',1440);
  first_share_id := (first_created->>'share_id')::uuid;

  -- A second mint is the normal "Share again" path. It must invalidate the old
  -- bearer capability before returning the fresh one.
  created := public.create_academic_share('paper','89000000-0000-4000-8000-000000000031',1440);
  token := created->>'token';
  share_id := (created->>'share_id')::uuid;

  perform public._share_t('owner receives a 256-bit hex capability',
    token ~ '^[0-9a-f]{64}$', token);

  active := public.active_academic_share('paper','89000000-0000-4000-8000-000000000031');
  perform public._share_t('owner can see active share metadata without the token',
    (active->>'share_id')::uuid=share_id and not (active ? 'token'));

  perform set_config('axon.test.first_share_id', first_share_id::text, true);
  perform set_config('axon.test.share_token', token, true);
  perform set_config('axon.test.share_id', share_id::text, true);
end $$;

-- Inspect the private registry only as the test/database owner. Authenticated
-- clients are deliberately denied SELECT on private.academic_share.
reset role;
do $$
declare
  token text := current_setting('axon.test.share_token', true);
  first_share_id uuid := current_setting('axon.test.first_share_id', true)::uuid;
  share_id uuid := current_setting('axon.test.share_id', true)::uuid;
  stored_hash text;
  unrevoked_count integer;
begin
  select encode(token_hash,'hex') into stored_hash
    from private.academic_share where id=share_id;
  perform public._share_t('raw capability is not stored',
    stored_hash is not null and stored_hash <> token);

  select count(*) into unrevoked_count
    from private.academic_share
   where guardian_id='89000000-0000-4000-8000-000000000011'
     and resource_type='paper'
     and paper_id='89000000-0000-4000-8000-000000000031'
     and revoked_at is null;

  perform public._share_t('remint revokes the previous paper capability',
    exists(select 1 from private.academic_share where id=first_share_id and revoked_at is not null)
    and unrevoked_count=1);
end $$;

-- Even a privileged accidental write cannot leave a second unrevoked bearer
-- capability for the same paper; the partial unique index is the final guard.
do $$
begin
  begin
    insert into private.academic_share(
      guardian_id,student_id,resource_type,paper_id,attempt_id,token_hash,expires_at
    ) values (
      '89000000-0000-4000-8000-000000000011',
      '89000000-0000-4000-8000-000000000021',
      'paper',
      '89000000-0000-4000-8000-000000000031',
      null,
      digest(repeat('d',64),'sha256'),
      now()+interval '1 hour'
    );
    perform public._share_t('database forbids a second unrevoked paper capability', false, 'insert succeeded');
  exception when unique_violation then
    perform public._share_t('database forbids a second unrevoked paper capability', true);
  end;
end $$;

-- ── anonymous resolution returns only the selected academic snapshot ───────

reset role;
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

do $$
declare
  payload jsonb;
  token text := current_setting('axon.test.share_token', true);
begin
  payload := public.resolve_academic_share(token);

  perform public._share_t('anonymous recipient can resolve the valid paper capability',
    (payload->>'found')::boolean and payload->>'kind'='paper');

  perform public._share_t('paper share contains the chosen paper and question',
    payload#>>'{paper,subject}'='Physics'
    and payload#>>'{questions,0,question_label}'='Q1'
    and payload#>>'{questions,0,student_answer}'='Two');

  perform public._share_t('paper share does not expose account identity or sibling work',
    position('Student Secret A' in payload::text)=0
    and position('private-a@test.invalid' in payload::text)=0
    and position('Private sibling question' in payload::text)=0
    and position('89000000-0000-4000-8000-000000000021' in payload::text)=0);

  perform public._share_t('unknown capability is indistinguishable from unavailable',
    (public.resolve_academic_share(repeat('0',64))->>'found')::boolean=false);
end $$;

-- ── question capability is scoped to that question only ───────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._share_claims('89000000-0000-4000-8000-000000000001', interval '5 seconds'), true);

do $$
declare created jsonb;
begin
  created := public.create_academic_share('question','89000000-0000-4000-8000-000000000041',60);
  perform set_config('axon.test.question_token', created->>'token', true);
  perform set_config('axon.test.question_share_id', created->>'share_id', true);
end $$;

reset role;
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

do $$
declare payload jsonb := public.resolve_academic_share(current_setting('axon.test.question_token', true));
begin
  perform public._share_t('question capability resolves only one question',
    (payload->>'found')::boolean
    and payload->>'kind'='question'
    and payload#>>'{question,question_label}'='Q1'
    and not (payload ? 'questions'));

  perform public._share_t('question capability cannot traverse to sibling data',
    position('Private sibling question' in payload::text)=0
    and position('Private sibling answer' in payload::text)=0);
end $$;

-- ── revocation and expiry fail closed ──────────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._share_claims('89000000-0000-4000-8000-000000000001', interval '5 seconds'), true);

select public._share_t('owner can revoke the question share',
  public.revoke_academic_share(current_setting('axon.test.question_share_id', true)::uuid));

reset role;
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

select public._share_t('revoked capability no longer resolves',
  (public.resolve_academic_share(current_setting('axon.test.question_token', true))->>'found')::boolean=false);

reset role;
update private.academic_share
   set created_at = now()-interval '2 hours',
       expires_at = now()-interval '1 hour'
 where id = current_setting('axon.test.share_id', true)::uuid;

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select public._share_t('expired capability no longer resolves',
  (public.resolve_academic_share(current_setting('axon.test.share_token', true))->>'found')::boolean=false);

reset role;

select count(*) as total,
       count(*) filter(where passed) as passed,
       count(*) filter(where not passed) as failed
from public._share_r;
select seq,name,passed,detail from public._share_r where not passed order by seq;

rollback;
