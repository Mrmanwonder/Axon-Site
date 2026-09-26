-- ============================================================================
-- AXO-60 — Student Mode capability/session tests
-- ============================================================================
-- Runs in a transaction and leaves no data behind.
-- ============================================================================

begin;

create table public._student_scope_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._student_scope_test to authenticated;
grant usage, select on sequence public._student_scope_test_seq_seq to authenticated;

create or replace function public._scope_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._student_scope_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._scope_t(text, boolean, text) to authenticated;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','91111111-1111-4111-8111-111111111111','authenticated','authenticated','scope-a@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','92222222-2222-4222-8222-222222222222','authenticated','authenticated','scope-b@test.invalid','x',now(),now(),now());

insert into public.guardian(id,auth_user_id,name,contact,verified_at,verification_method,verification_ref) values
 ('9aaaaaaa-0000-4000-8000-000000000001','91111111-1111-4111-8111-111111111111','Scope Guardian A','scope-a@test.invalid',now(),'stub','scope-a'),
 ('9bbbbbbb-0000-4000-8000-000000000001','92222222-2222-4222-8222-222222222222','Scope Guardian B','scope-b@test.invalid',now(),'stub','scope-b');

insert into public.consent_event(guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g
cross join public.consent_purpose cp
where cp.is_required;

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 ('9aaaaaaa-0000-4000-8000-000000000002','9aaaaaaa-0000-4000-8000-000000000001','Alpha',11,'under_18'),
 ('9aaaaaaa-0000-4000-8000-000000000003','9aaaaaaa-0000-4000-8000-000000000001','Beta',12,'under_18'),
 ('9bbbbbbb-0000-4000-8000-000000000002','9bbbbbbb-0000-4000-8000-000000000001','Gamma',10,'under_18');

-- ── multi-profile: no fresh parent proof, no first selection ────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','91111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-session-a'
  )::text,
  true
);

do $$ begin
  begin
    perform public.set_student_scope('9aaaaaaa-0000-4000-8000-000000000002');
    perform public._scope_t('multi-profile first selection requires fresh Parent Mode', false, 'scope issued');
  exception when sqlstate '42501' then
    perform public._scope_t(
      'multi-profile first selection requires fresh Parent Mode',
      position('parent' in lower(sqlerrm)) > 0,
      sqlerrm
    );
  end;
end $$;

select public._scope_t(
  'failed selection creates no active scope',
  coalesce((public.student_scope_state()->>'active')::boolean, false) = false
);

-- ── fresh parent proof establishes exactly one owned student ───────────────
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','91111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-session-a',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);

select public.set_student_scope('9aaaaaaa-0000-4000-8000-000000000002', 900);

select public._scope_t(
  'selected student is allowed',
  private.student_scope_allows('9aaaaaaa-0000-4000-8000-000000000002')
);
select public._scope_t(
  'owned sibling is outside the active scope',
  not private.student_scope_allows('9aaaaaaa-0000-4000-8000-000000000003')
);
select public._scope_t(
  'unowned student is outside the active scope',
  not private.student_scope_allows('9bbbbbbb-0000-4000-8000-000000000002')
);

do $$ begin
  begin
    perform public.set_student_scope('9bbbbbbb-0000-4000-8000-000000000002', 900);
    perform public._scope_t('cannot scope to another guardian student', false, 'scope issued');
  exception when sqlstate '42501' then
    perform public._scope_t('cannot scope to another guardian student', true, sqlerrm);
  end;
end $$;

-- Same live student can refresh without repeatedly forcing Parent Mode.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','91111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-session-a'
  )::text,
  true
);
select public.set_student_scope('9aaaaaaa-0000-4000-8000-000000000002', 1200);
select public._scope_t(
  'same active student can refresh without fresh auth',
  private.student_scope_allows('9aaaaaaa-0000-4000-8000-000000000002')
);

-- But an actual sibling switch still requires a parent.
do $$ begin
  begin
    perform public.set_student_scope('9aaaaaaa-0000-4000-8000-000000000003', 900);
    perform public._scope_t('sibling switch requires fresh Parent Mode', false, 'scope switched');
  exception when sqlstate '42501' then
    perform public._scope_t('sibling switch requires fresh Parent Mode', true, sqlerrm);
  end;
end $$;

-- ── the exact signed auth session is part of the authority ─────────────────
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','91111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-session-a-replayed-elsewhere'
  )::text,
  true
);
select public._scope_t(
  'different auth session cannot reuse another session scope',
  not private.student_scope_allows('9aaaaaaa-0000-4000-8000-000000000002')
);

-- Missing session_id fails closed even for the owning guardian.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','91111111-1111-4111-8111-111111111111',
    'role','authenticated'
  )::text,
  true
);
select public._scope_t(
  'missing signed session id fails closed',
  not private.student_scope_allows('9aaaaaaa-0000-4000-8000-000000000002')
);

do $$ begin
  begin
    perform public.set_student_scope('9aaaaaaa-0000-4000-8000-000000000002', 900);
    perform public._scope_t('missing session id cannot establish scope', false, 'scope issued');
  exception when sqlstate '42501' then
    perform public._scope_t('missing session id cannot establish scope', true, sqlerrm);
  end;
end $$;

reset role;

-- ── expiry is authoritative server state ──────────────────────────────────
update private.student_scope_session
   set expires_at = now() - interval '1 second'
 where guardian_id='9aaaaaaa-0000-4000-8000-000000000001'
   and auth_session_id='scope-session-a';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','91111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','scope-session-a'
  )::text,
  true
);
select public._scope_t(
  'expired scope fails closed',
  not private.student_scope_allows('9aaaaaaa-0000-4000-8000-000000000002')
);

-- ── single-profile household can establish its only scope without reauth ──
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','92222222-2222-4222-8222-222222222222',
    'role','authenticated',
    'session_id','scope-session-b'
  )::text,
  true
);
select public.set_student_scope('9bbbbbbb-0000-4000-8000-000000000002', 900);
select public._scope_t(
  'single-profile household can establish its only scope',
  private.student_scope_allows('9bbbbbbb-0000-4000-8000-000000000002')
);

select public._scope_t(
  'clear scope reports a revocation',
  public.clear_student_scope()
);
select public._scope_t(
  'cleared scope no longer authorizes the student',
  not private.student_scope_allows('9bbbbbbb-0000-4000-8000-000000000002')
);

reset role;

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._student_scope_test;

select seq, name, passed, detail
from public._student_scope_test
where not passed
order by seq;

do $$
begin
  if exists (select 1 from public._student_scope_test where not passed) then
    raise exception 'AXO-60 student scope capability tests failed';
  end if;
end $$;

rollback;
