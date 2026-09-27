-- ============================================================================
-- AXO-63 — Student Mode stale/replay/resource-boundary abuse tests
-- ============================================================================
-- Exercises the capability against real academic RLS, not only the helper:
-- expiry, rotation A->B, replay from another signed auth session, and revoke.
-- ============================================================================

begin;

create table public._student_scope_replay_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._student_scope_replay_test to authenticated;
grant usage, select on sequence public._student_scope_replay_test_seq_seq to authenticated;

create or replace function public._scope_replay_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._student_scope_replay_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._scope_replay_t(text, boolean, text) to authenticated;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '63111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','scope-replay@test.invalid','x',
  now(),now(),now()
);

insert into public.guardian(
  id,auth_user_id,name,contact,verified_at,verification_method,verification_ref
) values (
  '63aaaaaa-0000-4000-8000-000000000001',
  '63111111-1111-4111-8111-111111111111',
  'Replay Guardian','scope-replay@test.invalid',
  now(),'stub','scope-replay'
);

insert into public.consent_event(
  guardian_id, student_id, purpose, granted, notice_version, method
)
select '63aaaaaa-0000-4000-8000-000000000001', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp
where cp.is_required;

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 ('63aaaaaa-0000-4000-8000-000000000002','63aaaaaa-0000-4000-8000-000000000001','Replay A',11,'under_18'),
 ('63aaaaaa-0000-4000-8000-000000000003','63aaaaaa-0000-4000-8000-000000000001','Replay B',12,'under_18');

insert into public.paper(id,student_id,type,tier,date_taken,subject) values
 ('63aaaaaa-0000-4000-8000-000000000010','63aaaaaa-0000-4000-8000-000000000002','unit_test','tier_1',current_date,'Physics'),
 ('63aaaaaa-0000-4000-8000-000000000011','63aaaaaa-0000-4000-8000-000000000003','unit_test','tier_1',current_date,'Chemistry');

-- ── Session S1 authorizes A with fresh Parent Mode ─────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s1',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('63aaaaaa-0000-4000-8000-000000000002',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s1'
  )::text,
  true
);

select public._scope_replay_t(
  'S1 active A can read A academic row',
  (select count(*)=1 from public.paper where id='63aaaaaa-0000-4000-8000-000000000010')
);
select public._scope_replay_t(
  'S1 active A cannot read owned sibling B row',
  (select count(*)=0 from public.paper where id='63aaaaaa-0000-4000-8000-000000000011')
);

-- ── Expiry blocks ordinary academic work, not merely the scope helper ───────
reset role;
update private.student_scope_session
   set issued_at=now()-interval '2 minutes',
       expires_at=now()-interval '1 second'
 where guardian_id='63aaaaaa-0000-4000-8000-000000000001'
   and auth_session_id='scope-replay-s1';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s1'
  )::text,
  true
);

select public._scope_replay_t(
  'expired S1 scope cannot read formerly active A paper',
  (select count(*)=0 from public.paper where id='63aaaaaa-0000-4000-8000-000000000010')
);

do $$ declare n integer; begin
  update public.paper set subject='expired-mutation'
   where id='63aaaaaa-0000-4000-8000-000000000010';
  get diagnostics n = row_count;
  perform public._scope_replay_t(
    'expired S1 scope cannot mutate formerly active A paper',
    n=0,
    'rows='||n
  );
end $$;

do $$ begin
  begin
    perform public.set_student_scope('63aaaaaa-0000-4000-8000-000000000002',900);
    perform public._scope_replay_t(
      'expired multi-profile scope cannot silently refresh without Parent Mode',
      false,
      'scope refreshed'
    );
  exception when sqlstate '42501' then
    perform public._scope_replay_t(
      'expired multi-profile scope cannot silently refresh without Parent Mode',
      true,
      sqlerrm
    );
  end;
end $$;

-- ── Fresh guardian rotates S1 from A to B ──────────────────────────────────
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s1',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('63aaaaaa-0000-4000-8000-000000000003',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s1'
  )::text,
  true
);

select public._scope_replay_t(
  'after A-to-B rotation old A authority is gone',
  (select count(*)=0 from public.paper where id='63aaaaaa-0000-4000-8000-000000000010')
);
select public._scope_replay_t(
  'after A-to-B rotation B academic row is readable',
  (select count(*)=1 from public.paper where id='63aaaaaa-0000-4000-8000-000000000011')
);

-- ── A second signed auth session cannot replay S1's active B scope ──────────
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s2'
  )::text,
  true
);

select public._scope_replay_t(
  'different signed session has no active student scope',
  coalesce((public.student_scope_state()->>'active')::boolean,false)=false
);
select public._scope_replay_t(
  'different signed session cannot replay S1 B academic authority',
  (select count(*)=0 from public.paper where id='63aaaaaa-0000-4000-8000-000000000011')
);

-- Returning to S1 still proves the authority is session-bound, not guardian-global.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','63111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-replay-s1'
  )::text,
  true
);
select public._scope_replay_t(
  'original S1 retains only its current B scope',
  (select count(*)=1 from public.paper where id='63aaaaaa-0000-4000-8000-000000000011')
  and
  (select count(*)=0 from public.paper where id='63aaaaaa-0000-4000-8000-000000000010')
);

-- ── Explicit revocation blocks academic reads and writes immediately ────────
select public._scope_replay_t(
  'clear_student_scope revokes current S1 scope',
  public.clear_student_scope()
);
select public._scope_replay_t(
  'revoked S1 cannot read B academic row',
  (select count(*)=0 from public.paper where id='63aaaaaa-0000-4000-8000-000000000011')
);

do $$ declare n integer; begin
  update public.paper set subject='revoked-mutation'
   where id='63aaaaaa-0000-4000-8000-000000000011';
  get diagnostics n = row_count;
  perform public._scope_replay_t(
    'revoked S1 cannot mutate B academic row',
    n=0,
    'rows='||n
  );
end $$;

reset role;

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._student_scope_replay_test;

select seq,name,passed,detail
from public._student_scope_replay_test
where not passed
order by seq;

do $$
begin
  if exists (select 1 from public._student_scope_replay_test where not passed) then
    raise exception 'AXO-63 student scope replay tests failed';
  end if;
end $$;

rollback;
