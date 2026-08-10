-- ============================================================================
-- 0007 · Pages of an uploaded paper, and where each one came from
-- ============================================================================
-- Two source kinds. An 'upload' already has bytes in storage and is ready for
-- extraction. A 'link' is a URL the guardian pasted: a browser cannot fetch
-- cross-origin and hand us the bytes, so the row is recorded as pending and a
-- server-side fetcher resolves it. Recording it as pending rather than
-- pretending it is ingested is the honest failure mode — hard rule 4.

create type public.page_source as enum ('upload', 'link');
create type public.page_status as enum ('pending', 'stored', 'extracted', 'unreadable');

create table public.paper_page (
  id           uuid               primary key default gen_random_uuid(),
  paper_id     uuid               not null,
  student_id   uuid               not null,
  page_number  smallint           not null check (page_number > 0),
  source_kind  public.page_source not null,
  storage_path text,
  source_url   text,
  status       public.page_status not null default 'pending',
  created_at   timestamptz        not null default now(),

  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,
  unique (paper_id, page_number),

  -- Neither kind can be recorded as present without the thing that makes it
  -- present: an upload with no bytes, or a link with no URL, is a page that
  -- looks ingested and is not.
  constraint upload_has_a_path check (source_kind <> 'upload' or storage_path is not null),
  constraint link_has_a_url    check (source_kind <> 'link'   or source_url   is not null)
);

comment on table public.paper_page is
  'One page of a paper. Uploads carry a storage path; links carry a URL and stay pending until a server-side fetcher resolves them.';

alter table public.paper_page enable row level security;

create policy paper_page_all_own on public.paper_page for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = paper_page.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = paper_page.student_id and s.guardian_id = private.current_guardian_id()));

create index paper_page_paper_idx on public.paper_page (paper_id, page_number);

-- Storing a page is processing an uploaded paper, so it is gated on the same
-- consent as the paper itself: withdrawal stops new pages, not just new papers.
create or replace function private.enforce_page_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guardian uuid;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = new.student_id;
  if v_guardian is null then
    raise exception 'unknown student %', new.student_id using errcode = '23503';
  end if;
  if not private.consent_is_granted(v_guardian, new.student_id, 'store_papers') then
    raise exception 'cannot store a page: store_papers consent is not currently granted' using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger paper_page_consent_gate before insert on public.paper_page
  for each row execute function private.enforce_page_consent_gate();
