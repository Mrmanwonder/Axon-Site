-- AXO-188: service-issued capture bindings and immutable post-submit originals.
-- Old upload intents remain compatible and have no late-attachment authority.
alter table public.upload
  add column asset_kind text,
  add column page_number smallint,
  add column page_revision text,
  add column page_key text;
alter table public.upload add constraint upload_capture_binding check (
  (asset_kind is null and page_number is null and page_revision is null and page_key is null)
  or (asset_kind in ('page','mask','thumb','raw') and page_number is not null and page_revision is not null and page_number between 1 and 25
      and page_revision ~ '^[A-Za-z0-9-]{1,80}$'
      and ((asset_kind = 'raw' and page_key is not null) or (asset_kind <> 'raw' and page_key is null)))
);
comment on column public.upload.page_revision is 'Capture identity recorded by the authenticated upload API; not an integrity hash or secret.';
comment on column public.upload.page_key is 'Raw intent binding to a server-issued conditioned page capability.';

create function private.attach_paper_originals(p_student_id uuid, p_paper_id uuid, p_pages jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_page public.paper_page%rowtype;
  v_upload public.upload%rowtype;
  v_item jsonb;
  v_number integer;
  v_key text;
  v_attached jsonb := '[]'::jsonb;
begin
  if current_user <> 'service_role' then raise exception 'Service authority required' using errcode='42501'; end if;
  if p_student_id is null or p_paper_id is null or pg_catalog.jsonb_typeof(p_pages) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_pages) < 1 or pg_catalog.jsonb_array_length(p_pages) > 25 then
    raise exception 'Invalid original batch' using errcode='22023';
  end if;
  -- submit_paper first updates/locks the paper, then takes this advisory lock.
  -- Keep that order to avoid a lock inversion with simultaneous submissions.
  perform 1 from public.paper p join public.student s on s.id=p.student_id
    where p.id=p_paper_id and p.student_id=p_student_id and s.deleted_at is null for update of p;
  if not found then raise exception 'Paper is unavailable' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_paper_id::text,0));
  if (select count(distinct (value->>'page_number')) from pg_catalog.jsonb_array_elements(p_pages))
      <> pg_catalog.jsonb_array_length(p_pages) then raise exception 'Duplicate page' using errcode='22023'; end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_pages) loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
       or (v_item->>'page_number') !~ '^[1-9][0-9]?$'
       or (v_item->>'page_revision') !~ '^[A-Za-z0-9-]{1,80}$'
       or v_item->>'original_key' is null or v_item->>'page_key' is null then
      raise exception 'Invalid original' using errcode='22023';
    end if;
    v_number := (v_item->>'page_number')::integer;
    if v_number not between 1 and 25 then raise exception 'Invalid page' using errcode='22023'; end if;
    select * into v_page from public.paper_page p
      where p.paper_id=p_paper_id and p.student_id=p_student_id and p.page_number=v_number for update;
    if not found or v_page.r2_bucket is distinct from 'derived'
       or v_page.r2_key is distinct from (v_item->>'page_key')
       or v_page.conditioning_meta->>'upload_revision' is distinct from (v_item->>'page_revision') then
      raise exception 'Original does not match the current page' using errcode='42501';
    end if;
    v_key := v_item->>'original_key';
    select * into v_upload from public.upload u where u.paper_id=p_paper_id and u.student_id=p_student_id
      and u.r2_bucket='originals' and u.r2_key=v_key for update;
    if not found or not v_upload.confirmed or v_upload.asset_kind is distinct from 'raw'
       or v_upload.page_number is distinct from v_number
       or v_upload.page_revision is distinct from (v_item->>'page_revision')
       or v_upload.page_key is null or not private.asset_key_owned(v_upload.page_key,p_student_id,p_paper_id) or v_upload.bytes is null or v_upload.bytes not between 1 and 26214400
       or v_upload.etag is null or v_upload.etag = '' or v_upload.content_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf')
       or not private.asset_key_owned(v_key,p_student_id,p_paper_id)
       or v_key not like p_student_id::text || '/' || p_paper_id::text || '/raw/p' || v_number::text || '-original-%'
       or v_key ~ '\.pending$' then
      raise exception 'Original requires a confirmed issued capture binding' using errcode='42501';
    end if;
    if not exists (select 1 from public.upload u where u.paper_id=p_paper_id and u.student_id=p_student_id
      and u.r2_bucket='derived' and u.r2_key=v_upload.page_key and u.asset_kind='page'
      and u.page_number=v_number and u.page_revision=v_upload.page_revision) then
      raise exception 'Original binding was not issued for this capture' using errcode='42501';
    end if;
    -- A refreshed page capability can have a different nonce for the same
    -- capture. Require its confirmed issued number/revision, never just a
    -- client claim, before accepting that alias.
    if not exists (select 1 from public.upload u where u.paper_id=p_paper_id and u.student_id=p_student_id
      and u.r2_bucket='derived' and u.r2_key=v_page.r2_key and u.confirmed
      and u.asset_kind='page' and u.page_number=v_number and u.page_revision=v_upload.page_revision) then
      raise exception 'Conditioned page binding is unconfirmed' using errcode='42501';
    end if;
    if v_page.original_key is not null and v_page.original_key <> v_key then
      raise exception 'A different original is already attached' using errcode='42501';
    end if;
    update public.paper_page set original_key=v_key where id=v_page.id;
    v_attached := v_attached || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('page_number',v_number,'key',v_key));
  end loop;
  return pg_catalog.jsonb_build_object('attached',v_attached);
end; $$;
revoke all on function private.attach_paper_originals(uuid,uuid,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.asset_key_owned(text,uuid,uuid) to service_role;
grant execute on function private.attach_paper_originals(uuid,uuid,jsonb) to service_role;
create function public.attach_paper_originals(p_student_id uuid,p_paper_id uuid,p_pages jsonb)
returns jsonb language sql security invoker set search_path=''
as $$ select private.attach_paper_originals(p_student_id,p_paper_id,p_pages); $$;
revoke all on function public.attach_paper_originals(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.attach_paper_originals(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';

-- A true retake must clear the old capture's original; an unchanged manifest
-- retry must preserve an independently attached original.
do $$
declare
 v_definition text;
 v_pattern text := 'original_key[[:space:]]*=[[:space:]]*coalesce[(][[:space:]]*excluded[.]original_key[[:space:]]*,[[:space:]]*paper_page[.]original_key[[:space:]]*[)]';
begin
  select pg_catalog.pg_get_functiondef('public.submit_paper(uuid,public.paper_type,public.paper_tier,date,text,jsonb,uuid,numeric,numeric,text,uuid)'::regprocedure) into v_definition;
  if v_definition is null or v_definition !~ v_pattern then
    raise exception 'submit_paper original association changed; review this migration';
  end if;
  execute pg_catalog.regexp_replace(v_definition,v_pattern,
    'original_key = case when paper_page.r2_key is distinct from excluded.r2_key then excluded.original_key else coalesce(excluded.original_key,paper_page.original_key) end');
end; $$;

create function private.guard_original_association()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_upload public.upload%rowtype;
begin
  if tg_op='UPDATE' and old.r2_key is not distinct from new.r2_key
      and old.r2_bucket is not distinct from new.r2_bucket and old.original_key is not null
      and old.original_key is distinct from new.original_key then
    raise exception 'A different original is already attached' using errcode='42501';
  end if;
  if new.original_key is null then return new; end if;
  if tg_op='UPDATE' and old.original_key is not distinct from new.original_key
    and old.r2_key is not distinct from new.r2_key then return new; end if;
  select * into v_upload from public.upload u where u.paper_id=new.paper_id and u.student_id=new.student_id
    and u.r2_bucket='originals' and u.r2_key=new.original_key;
  -- Historical intents remain compatible. New capture bindings are enforced
  -- even for direct authenticated page updates, not just the new API endpoint.
  if found and v_upload.asset_kind is not null and (
     v_upload.asset_kind is distinct from 'raw' or not v_upload.confirmed
     or v_upload.page_number is distinct from new.page_number
     or v_upload.page_revision is distinct from (new.conditioning_meta->>'upload_revision')
     or not exists (select 1 from public.upload u where u.paper_id=new.paper_id and u.student_id=new.student_id
       and u.r2_bucket='derived' and u.r2_key=new.r2_key and u.confirmed and u.asset_kind='page'
       and u.page_number=new.page_number and u.page_revision=v_upload.page_revision)
  ) then raise exception 'Original does not match this capture' using errcode='42501'; end if;
  return new;
end; $$;
revoke all on function private.guard_original_association() from public,anon,authenticated;
create trigger guard_original_association before insert or update on public.paper_page
for each row execute function private.guard_original_association();
