-- ============================================================================
-- AXO-263: weekly parent digest
-- ============================================================================
-- What this adds: a delivery ledger, one function that assembles a digest from
-- the vetted analytics views, and the queue/claim/finish contract the sweep
-- Worker drives (the same shape as claim_stage_outbox). The Worker renders and
-- sends the email; the database decides who is owed one.
--
-- Rules this file holds (Axon.md):
--   * Opt-in is the `weekly_parent_digest` consent in the append-only ledger,
--     checked at queue time AND again at claim time, so a withdrawal made after
--     queueing still stops the email.
--   * Hard rule 3: figures come only from attempt_analytics, mark_loss_analytics
--     and student_analytics_readiness, never the base tables.
--   * No ranking, comparing or predicting a student: there is no trend and no
--     grade outlook here.
--   * A command word is named only once it covers 3 questions that lost marks
--     (owner decision, 5 Oct), and only across 2 or more papers.
--   * With fewer than four papers overall, no pattern is named.
--   * Erasure keeps guardian and student rows as tombstones, so this ledger
--     stores no names, no email and no figures. The payload is rebuilt from live
--     data at claim time; an erased student builds to nothing and is skipped.
--   * Free, this week only (owner decision, 12 Oct). Nothing here calls
--     guardian_is_pro; parent_progress_report stays the Pro multi-week report.
-- ============================================================================

create table if not exists private.parent_digest_delivery (
  id            uuid        primary key default gen_random_uuid(),
  guardian_id   uuid        not null references public.guardian (id) on delete cascade,
  student_id    uuid        not null references public.student (id) on delete cascade,
  period_start  date        not null,
  period_end    date        not null check (period_end >= period_start),
  status        text        not null default 'pending'
                            check (status in ('pending', 'sent', 'failed', 'skipped')),
  skip_reason   text,
  send_attempts integer     not null default 0,
  available_at  timestamptz not null default now(),
  claimed_until timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  unique (student_id, period_end)
);

comment on table private.parent_digest_delivery is
  'AXO-263: one weekly parent digest owed, sent, skipped or failed. Ids, dates and status only: no names, no address, no figures (erasure keeps tombstone rows, so the content is rebuilt at send time). Service role and definer functions only.';

alter table private.parent_digest_delivery enable row level security;
revoke all on private.parent_digest_delivery from public, anon, authenticated;

-- ── content ────────────────────────────────────────────────────────────────
-- Everything the email may say, as data. Returns null for an erased or missing
-- student, which the claim treats as "nothing to send".
create or replace function private.build_parent_digest(p_student uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_first     text;
  v_from      timestamptz := (p_start::timestamp at time zone 'UTC');
  v_to        timestamptz := ((p_end + 1)::timestamp at time zone 'UTC');
  v_papers    integer;
  v_subjects  text[];
  v_counted   integer;
  v_lost_q    integer;
  v_lost_m    integer;
  v_ready     record;
  v_areas     jsonb := '[]'::jsonb;
begin
  select s.first_name into v_first
    from public.student s
   where s.id = p_student and s.deleted_at is null;
  if v_first is null then return null; end if;

  with wp as (
    select distinct r.paper_id
      from public.extraction_run r
     where r.student_id = p_student
       and r.status::text = 'committed'
       and r.committed_at >= v_from and r.committed_at < v_to
  ),
  att as (
    select a.id
      from public.attempt_analytics a
      join wp on wp.paper_id = a.paper_id
     where a.student_id = p_student
  ),
  loss as (
    select m.attempt_id, m.marks_lost
      from public.mark_loss_analytics m
      join att on att.id = m.attempt_id
     where m.student_id = p_student
  )
  select (select count(*) from wp)::int,
         (select count(*) from att)::int,
         (select count(distinct attempt_id) from loss)::int,
         (select coalesce(round(sum(marks_lost)), 0) from loss)::int
    into v_papers, v_counted, v_lost_q, v_lost_m;

  select coalesce(array_agg(distinct btrim(p.subject)) filter (where btrim(p.subject) <> ''), '{}')
    into v_subjects
    from public.paper p
   where p.id in (
     select r.paper_id from public.extraction_run r
      where r.student_id = p_student and r.status::text = 'committed'
        and r.committed_at >= v_from and r.committed_at < v_to);

  select rd.papers_counted, rd.questions_counted, rd.has_enough_data
    into v_ready
    from public.student_analytics_readiness rd
   where rd.student_id = p_student;

  if coalesce(v_ready.has_enough_data, false) then
    select coalesce(jsonb_agg(x order by x.marks_lost desc, x.questions desc, x.name), '[]'::jsonb)
      into v_areas
      from (
        select 'command_word'::text                         as kind,
               initcap(lower(btrim(m.command_word)))        as name,
               count(distinct m.attempt_id)::int            as questions,
               count(distinct a.paper_id)::int              as papers,
               round(sum(m.marks_lost))::int                as marks_lost
          from public.mark_loss_analytics m
          join public.attempt_analytics a on a.id = m.attempt_id
         where m.student_id = p_student
           and btrim(coalesce(m.command_word, '')) <> ''
         group by lower(btrim(m.command_word))
        having count(distinct m.attempt_id) >= 3
           and count(distinct a.paper_id) >= 2
         order by sum(m.marks_lost) desc, count(distinct m.attempt_id) desc, lower(btrim(m.command_word))
         limit 2
      ) x;
  end if;

  return jsonb_build_object(
    'first_name',       v_first,
    'period_start',     p_start,
    'period_end',       p_end,
    'papers_committed', v_papers,
    'subjects',         to_jsonb(v_subjects),
    'questions_counted', v_counted,
    'questions_lost',   v_lost_q,
    'marks_lost',       v_lost_m,
    'papers_counted',   coalesce(v_ready.papers_counted, 0),
    'has_enough_data',  coalesce(v_ready.has_enough_data, false),
    'areas',            v_areas
  );
end;
$$;

revoke all on function private.build_parent_digest(uuid, date, date) from public, anon, authenticated;

comment on function private.build_parent_digest(uuid, date, date) is
  'AXO-263: the data behind one weekly parent digest, from the analytics views only. Null for an erased or missing student. Not callable by clients.';

-- ── queue: who is owed a digest this week ──────────────────────────────────
create or replace function public.queue_parent_digests(
  p_period_end date default ((now() at time zone 'utc')::date)
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_start date := p_period_end - 6;
  v_from  timestamptz := (v_start::timestamp at time zone 'UTC');
  v_to    timestamptz := ((p_period_end + 1)::timestamp at time zone 'UTC');
  v_n     integer;
begin
  insert into private.parent_digest_delivery (guardian_id, student_id, period_start, period_end)
  select g.id, s.id, v_start, p_period_end
    from public.student s
    join public.guardian g on g.id = s.guardian_id
   where s.deleted_at is null
     and g.deleted_at is null
     and g.auth_user_id is not null
     and private.consent_is_granted(g.id, s.id, 'weekly_parent_digest')
     and exists (
       select 1 from public.extraction_run r
        where r.student_id = s.id and r.status::text = 'committed'
          and r.committed_at >= v_from and r.committed_at < v_to)
  on conflict (student_id, period_end) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ── claim: hand the Worker up to p_limit digests to send ───────────────────
create or replace function public.claim_parent_digests(p_limit integer default 25)
returns table (delivery_id uuid, to_email text, payload jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r         record;
  v_email   text;
  v_payload jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'limit must be 1 to 100' using errcode = '22023';
  end if;

  -- Out of attempts: say so in the table instead of retrying forever.
  update private.parent_digest_delivery d
     set status = 'failed', claimed_until = null,
         last_error = coalesce(d.last_error, 'attempts exhausted')
   where d.status = 'pending' and d.send_attempts >= 5
     and (d.claimed_until is null or d.claimed_until < now());

  for r in
    select d.id, d.guardian_id, d.student_id, d.period_start, d.period_end
      from private.parent_digest_delivery d
     where d.status = 'pending'
       and d.available_at <= now()
       and (d.claimed_until is null or d.claimed_until < now())
       and d.send_attempts < 5
     order by d.created_at
     limit p_limit
     for update skip locked
  loop
    select u.email into v_email
      from public.guardian g
      join auth.users u on u.id = g.auth_user_id
     where g.id = r.guardian_id and g.deleted_at is null;

    -- A withdrawal (or erasure) after queueing wins over the queue.
    if v_email is null or btrim(v_email) = '' then
      update private.parent_digest_delivery
         set status = 'skipped', skip_reason = 'no_recipient', claimed_until = null
       where id = r.id;
      continue;
    end if;
    if not private.consent_is_granted(r.guardian_id, r.student_id, 'weekly_parent_digest') then
      update private.parent_digest_delivery
         set status = 'skipped', skip_reason = 'consent_withdrawn', claimed_until = null
       where id = r.id;
      continue;
    end if;

    v_payload := private.build_parent_digest(r.student_id, r.period_start, r.period_end);
    if v_payload is null then
      update private.parent_digest_delivery
         set status = 'skipped', skip_reason = 'student_erased', claimed_until = null
       where id = r.id;
      continue;
    end if;

    update private.parent_digest_delivery
       set claimed_until = now() + interval '10 minutes',
           send_attempts = send_attempts + 1
     where id = r.id;

    delivery_id := r.id;
    to_email    := v_email;
    payload     := v_payload;
    return next;
  end loop;
end;
$$;

-- ── finish: sent, or back off and say why ──────────────────────────────────
create or replace function public.finish_parent_digest(p_id uuid, p_sent boolean, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_sent then
    update private.parent_digest_delivery
       set status = 'sent', sent_at = now(), claimed_until = null, last_error = null
     where id = p_id and status = 'pending';
  else
    update private.parent_digest_delivery d
       set claimed_until = null,
           last_error    = left(coalesce(p_error, 'send failed'), 300),
           available_at  = now() + (d.send_attempts * interval '15 minutes'),
           status        = case when d.send_attempts >= 5 then 'failed' else 'pending' end
     where d.id = p_id and d.status = 'pending';
  end if;
end;
$$;

revoke all on function public.queue_parent_digests(date) from public, anon, authenticated;
revoke all on function public.claim_parent_digests(integer) from public, anon, authenticated;
revoke all on function public.finish_parent_digest(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.queue_parent_digests(date) to service_role;
grant execute on function public.claim_parent_digests(integer) to service_role;
grant execute on function public.finish_parent_digest(uuid, boolean, text) to service_role;

comment on function public.queue_parent_digests(date) is
  'AXO-263: queues one digest per consenting guardian and student with a paper committed in the 7 days ending p_period_end (UTC). Idempotent per student and period. Service role only.';
comment on function public.claim_parent_digests(integer) is
  'AXO-263: hands the sweep Worker up to p_limit digests to send, each claimed for 10 minutes, with the recipient and a freshly built payload. Re-checks consent and erasure. Service role only.';
comment on function public.finish_parent_digest(uuid, boolean, text) is
  'AXO-263: marks a digest sent, or records the failure and backs off 15 minutes per attempt; the fifth failure is terminal and stays visible. Service role only.';
