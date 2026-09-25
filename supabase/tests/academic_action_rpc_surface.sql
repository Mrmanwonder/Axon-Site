begin;

create table public._rpc_surface_r (
  seq serial primary key,
  name text,
  passed boolean,
  detail text
);
create or replace function public._rpc_surface_t(n text, p boolean, d text default null)
returns void language sql as $$
  insert into public._rpc_surface_r(name,passed,detail) values(n,p,d);
$$;

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('delete_question', 'p_attempt_id uuid'),
      ('create_academic_share', 'p_resource_type text, p_resource_id uuid, p_expires_minutes integer'),
      ('active_academic_share', 'p_resource_type text, p_resource_id uuid'),
      ('revoke_academic_share', 'p_share_id uuid')
    ) as x(name,args)
  loop
    perform public._rpc_surface_t(
      rec.name || ' public facade is SECURITY INVOKER',
      exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public'
          and p.proname=rec.name
          and pg_get_function_identity_arguments(p.oid)=rec.args
          and p.prosecdef=false
      )
    );

    perform public._rpc_surface_t(
      rec.name || ' privileged body is private SECURITY DEFINER',
      exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='private'
          and p.proname=rec.name
          and pg_get_function_identity_arguments(p.oid)=rec.args
          and p.prosecdef=true
      )
    );
  end loop;
end $$;

select public._rpc_surface_t(
  'anonymous resolver remains the only intentional AXO-87 public SECURITY DEFINER endpoint',
  (
    select count(*) = 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'delete_question',
        'create_academic_share',
        'active_academic_share',
        'revoke_academic_share',
        'resolve_academic_share'
      )
      and p.prosecdef
  )
  and (
    select p.proname='resolve_academic_share'
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'delete_question',
        'create_academic_share',
        'active_academic_share',
        'revoke_academic_share',
        'resolve_academic_share'
      )
      and p.prosecdef
    limit 1
  )
);

select public._rpc_surface_t(
  'anonymous cannot execute owner-only public facades',
  not has_function_privilege('anon','public.delete_question(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.create_academic_share(text,uuid,integer)','EXECUTE')
  and not has_function_privilege('anon','public.active_academic_share(text,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.revoke_academic_share(uuid)','EXECUTE')
);

select public._rpc_surface_t(
  'anonymous can execute only the capability resolver',
  has_function_privilege('anon','public.resolve_academic_share(text)','EXECUTE')
);

select count(*) as total,
       count(*) filter(where passed) as passed,
       count(*) filter(where not passed) as failed
from public._rpc_surface_r;
select seq,name,passed,detail from public._rpc_surface_r where not passed order by seq;

rollback;
