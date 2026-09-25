-- ============================================================================
-- AXO-87 / AXO-89 — Privacy-safe read-only academic sharing
-- ============================================================================
-- A share link is a bearer capability, but the bearer secret is never stored.
-- The browser receives 32 random bytes encoded as 64 hex characters; Postgres
-- stores only SHA-256(token). The public URL keeps the token in the fragment,
-- so it is not part of the HTTP request URL/referrer. The standalone /share
-- page POSTs it to resolve_academic_share().
--
-- The table lives in private and is not exposed through PostgREST. Only the
-- narrow functions below can create, inspect, revoke or resolve a share.
-- ============================================================================

create table if not exists private.academic_share (
  id            uuid        primary key default gen_random_uuid(),
  guardian_id   uuid        not null,
  student_id    uuid        not null,
  resource_type text        not null check (resource_type in ('paper', 'question')),
  paper_id      uuid        not null,
  attempt_id    uuid,
  token_hash    bytea       not null unique,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz,

  -- Ownership is structural, not merely trusted to the minting function.
  foreign key (student_id, guardian_id)
    references public.student (id, guardian_id) on delete cascade,
  foreign key (paper_id, student_id)
    references public.paper (id, student_id) on delete cascade,
  foreign key (attempt_id, student_id)
    references public.student_attempt (id, student_id) on delete cascade,

  constraint academic_share_resource_shape check (
    (resource_type = 'paper' and attempt_id is null)
    or
    (resource_type = 'question' and attempt_id is not null)
  ),
  constraint academic_share_expiry_after_creation check (expires_at > created_at)
);

-- Cover every FK from its leading column(s), so deletion/cascade does not add
-- fresh unindexed-FK debt to the production advisor.
create index if not exists academic_share_student_guardian_idx
  on private.academic_share (student_id, guardian_id);
create index if not exists academic_share_paper_student_idx
  on private.academic_share (paper_id, student_id);
create index if not exists academic_share_attempt_student_idx
  on private.academic_share (attempt_id, student_id);

create index if not exists academic_share_guardian_resource_idx
  on private.academic_share (guardian_id, resource_type, paper_id, attempt_id);
create index if not exists academic_share_active_expiry_idx
  on private.academic_share (expires_at)
  where revoked_at is null;

-- One raw capability is intentionally unrecoverable after minting, so there is
-- never a valid reason to retain two unrevoked links for the same resource.
-- Coalescing the paper-share NULL attempt gives paper and question shares the
-- same concurrency guarantee without relying on NULL uniqueness semantics.
create unique index if not exists academic_share_one_unrevoked_resource_idx
  on private.academic_share (
    guardian_id,
    resource_type,
    paper_id,
    coalesce(attempt_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

revoke all on table private.academic_share from public, anon, authenticated;

comment on table private.academic_share is
  'AXO-89. Guardian-authorised, expiring, revocable read-only academic shares. Raw bearer tokens are never stored; only SHA-256 hashes live here.';

-- ── create / replace one active share for one resource ─────────────────────

create or replace function public.create_academic_share(
  p_resource_type text,
  p_resource_id uuid,
  p_expires_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_student  uuid;
  v_paper    uuid;
  v_attempt  uuid;
  v_token    text;
  v_share    uuid;
  v_expires  timestamptz;
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.has_fresh_auth() then
    raise exception 'this needs a parent to confirm it is them'
      using errcode = '42501', hint = 'parent_mode_required';
  end if;
  if p_resource_type not in ('paper', 'question') then
    raise exception 'unknown share resource' using errcode = '22023';
  end if;
  if p_expires_minutes < 5 or p_expires_minutes > 10080 then
    raise exception 'share expiry must be between 5 minutes and 7 days'
      using errcode = '22023';
  end if;

  if p_resource_type = 'paper' then
    select p.student_id, p.id
      into v_student, v_paper
      from public.paper p
      join public.student s on s.id = p.student_id
     where p.id = p_resource_id
       and s.guardian_id = v_guardian;
  else
    select a.student_id, a.paper_id, a.id
      into v_student, v_paper, v_attempt
      from public.student_attempt a
      join public.student s on s.id = a.student_id
     where a.id = p_resource_id
       and s.guardian_id = v_guardian;
  end if;

  if v_student is null or v_paper is null then
    raise exception 'no such resource' using errcode = 'P0002';
  end if;

  -- There is only one active capability per guardian/resource. Creating a new
  -- link replaces the old one so the UI never needs to recover a raw token
  -- (which, intentionally, is impossible after creation).
  update private.academic_share
     set revoked_at = now()
   where guardian_id = v_guardian
     and resource_type = p_resource_type
     and paper_id = v_paper
     and (
       (p_resource_type = 'paper' and attempt_id is null)
       or
       (p_resource_type = 'question' and attempt_id = v_attempt)
     )
     and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(mins => p_expires_minutes);

  insert into private.academic_share (
    guardian_id, student_id, resource_type, paper_id, attempt_id,
    token_hash, expires_at
  ) values (
    v_guardian, v_student, p_resource_type, v_paper, v_attempt,
    digest(v_token, 'sha256'), v_expires
  )
  returning id into v_share;

  return jsonb_build_object(
    'share_id', v_share,
    'resource_type', p_resource_type,
    'token', v_token,
    'expires_at', v_expires
  );
end;
$$;

revoke all on function public.create_academic_share(text, uuid, integer) from public, anon;
grant execute on function public.create_academic_share(text, uuid, integer) to authenticated;

comment on function public.create_academic_share(text, uuid, integer) is
  'AXO-89. Creates a fresh read-only bearer capability for one owned paper/question. Requires current guardian ownership and fresh Parent Mode.';

-- ── owner-visible state, never the raw token ───────────────────────────────

create or replace function public.active_academic_share(
  p_resource_type text,
  p_resource_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_share private.academic_share%rowtype;
begin
  if v_guardian is null then return null; end if;

  if p_resource_type = 'paper' then
    select sh.* into v_share
      from private.academic_share sh
      join public.paper p on p.id = sh.paper_id
      join public.student s on s.id = p.student_id
     where sh.guardian_id = v_guardian
       and s.guardian_id = v_guardian
       and sh.resource_type = 'paper'
       and sh.paper_id = p_resource_id
       and sh.attempt_id is null
       and sh.revoked_at is null
       and sh.expires_at > now()
     order by sh.created_at desc
     limit 1;
  elsif p_resource_type = 'question' then
    select sh.* into v_share
      from private.academic_share sh
      join public.student_attempt a on a.id = sh.attempt_id
      join public.student s on s.id = a.student_id
     where sh.guardian_id = v_guardian
       and s.guardian_id = v_guardian
       and sh.resource_type = 'question'
       and sh.attempt_id = p_resource_id
       and sh.revoked_at is null
       and sh.expires_at > now()
     order by sh.created_at desc
     limit 1;
  else
    return null;
  end if;

  if v_share.id is null then return null; end if;
  return jsonb_build_object(
    'share_id', v_share.id,
    'resource_type', v_share.resource_type,
    'expires_at', v_share.expires_at
  );
end;
$$;

revoke all on function public.active_academic_share(text, uuid) from public, anon;
grant execute on function public.active_academic_share(text, uuid) to authenticated;

-- ── revoke immediately ─────────────────────────────────────────────────────

create or replace function public.revoke_academic_share(p_share_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_count integer;
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.has_fresh_auth() then
    raise exception 'this needs a parent to confirm it is them'
      using errcode = '42501', hint = 'parent_mode_required';
  end if;

  update private.academic_share
     set revoked_at = coalesce(revoked_at, now())
   where id = p_share_id
     and guardian_id = v_guardian;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.revoke_academic_share(uuid) from public, anon;
grant execute on function public.revoke_academic_share(uuid) to authenticated;

-- ── public resolver: one capability -> one deliberately tiny snapshot ──────

create or replace function public.resolve_academic_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_share private.academic_share%rowtype;
  v_result jsonb;
begin
  -- Malformed, expired, revoked and unknown capabilities are intentionally
  -- indistinguishable to the caller.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('found', false);
  end if;

  select *
    into v_share
    from private.academic_share
   where token_hash = digest(p_token, 'sha256')
     and revoked_at is null
     and expires_at > now()
   limit 1;

  if v_share.id is null then
    return jsonb_build_object('found', false);
  end if;

  if v_share.resource_type = 'paper' then
    select jsonb_build_object(
      'found', true,
      'kind', 'paper',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'subject', p.subject,
        'total_awarded', p.total_awarded,
        'total_available', p.total_available,
        'reconciled', p.reconciled
      ),
      'questions', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'question_label', a.question_label,
            'question_text', a.question_text,
            'student_answer', a.student_answer,
            'marks_awarded', a.marks_awarded,
            'max_marks', a.max_marks,
            'marks_source', a.marks_source,
            'teacher_remark', a.teacher_remark,
            'extraction_confidence', a.extraction_confidence
          )
          order by coalesce(qr.order_index, 32767), a.question_label nulls last, a.id
        )
        from public.student_attempt a
        left join lateral (
          select min(q.order_index) as order_index
          from public.question_region q
          where q.committed_attempt_id = a.id
        ) qr on true
        where a.paper_id = v_share.paper_id
          and a.student_id = v_share.student_id
      ), '[]'::jsonb)
    )
    into v_result
    from public.paper p
    where p.id = v_share.paper_id
      and p.student_id = v_share.student_id;
  else
    select jsonb_build_object(
      'found', true,
      'kind', 'question',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'subject', p.subject
      ),
      'question', jsonb_build_object(
        'question_label', a.question_label,
        'question_text', a.question_text,
        'student_answer', a.student_answer,
        'marks_awarded', a.marks_awarded,
        'max_marks', a.max_marks,
        'marks_source', a.marks_source,
        'teacher_remark', a.teacher_remark,
        'extraction_confidence', a.extraction_confidence
      )
    )
    into v_result
    from public.student_attempt a
    join public.paper p
      on p.id = a.paper_id and p.student_id = a.student_id
    where a.id = v_share.attempt_id
      and a.paper_id = v_share.paper_id
      and a.student_id = v_share.student_id;
  end if;

  -- Deletion can race resolution. If the underlying resource vanished, expose
  -- the same unavailable state as an expired/revoked/unknown link.
  return coalesce(v_result, jsonb_build_object('found', false));
end;
$$;

revoke all on function public.resolve_academic_share(text) from public;
grant execute on function public.resolve_academic_share(text) to anon, authenticated;

comment on function public.resolve_academic_share(text) is
  'AXO-89. Public capability resolver. Returns only a deliberately minimal read-only academic snapshot; no account/contact data, internal IDs, signed R2 URLs, model logs or sibling resources.';
