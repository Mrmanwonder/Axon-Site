-- Synthetic corpus, not a retrieval-quality benchmark. All fixtures roll back.
begin;
create table public._r (seq serial primary key, name text, passed boolean, detail text);
create function public._t(n text, p boolean, d text default null) returns void language sql
as $$ insert into public._r(name,passed,detail) values(n,p,d) $$;
grant all on public._r to authenticated, anon, service_role;
grant usage, select on sequence public._r_seq_seq to authenticated, anon, service_role;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','a2260000-0000-4000-8000-000000000001',
  'authenticated','authenticated','axo226@test.invalid','x',now(),now(),now());
insert into public.guardian(id,auth_user_id,name,contact) values
('a2260000-0000-4000-8000-000000000002','a2260000-0000-4000-8000-000000000001','Retrieval test','axo226@test.invalid');
insert into public.consent_event(guardian_id,student_id,purpose,granted,notice_version,method)
select 'a2260000-0000-4000-8000-000000000002',null,purpose,true,'v1.0','in_app_itemised'
from public.consent_purpose where is_required;
insert into public.student(id,guardian_id,first_name,class_level,age_band) values
('a2260000-0000-4000-8000-000000000003','a2260000-0000-4000-8000-000000000002','Retrieval',10,'under_18');
insert into public.paper(id,student_id,type,tier,date_taken) values
('a2260000-0000-4000-8000-000000000004','a2260000-0000-4000-8000-000000000003','unit_test','tier_1','2026-10-10');

do $$
declare
  p uuid := 'a2260000-0000-4000-8000-000000000004';
  o uuid;
  doc uuid;
  other_doc uuid;
  objective uuid;
  parent uuid;
  wrong_parent uuid;
  identity_id uuid;
  result jsonb;
begin
  insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,
    external_code_kind,levels_supported,source_url,source_checked_at,variant)
  select so.programme_id,so.stage_id,so.subject_id,'Synthetic retrieval subject','AXO226',
    'subject_code','{}','https://example.invalid/axo226',now(),'axo226-fixture'
  from public.subject_offering so join public.curriculum_programme pr on pr.id=so.programme_id
  where pr.key='cbse_senior_secondary' and so.stage_id is not null limit 1 returning id into o;
  perform public._t('unverified subject unavailable',public.resolve_syllabus_retrieval_scope(p)->>'reason'='subject_unresolved');
  update public.paper set subject_offering_id=o,subject_verified_at=now() where id=p;
  perform public._t('upload year never substitutes for unknown exam year',public.resolve_syllabus_retrieval_scope(p)->>'reason'='exam_year_unresolved');
  update public.paper set exam_date='2026-06-01' where id=p;
  perform public._t('missing corpus is explicit',public.resolve_syllabus_retrieval_scope(p)->>'reason'='missing');
  insert into public.syllabus_document(provider_key,syllabus_code,title,version_label,valid_from_year,valid_to_year,
    source_url,source_sha256,fetched_at,status)
  values('cbse','AXO226','Synthetic retrieval fixture','test-v1',2025,2027,
    'https://example.invalid/axo226',repeat('a',64),now(),'draft') returning id into doc;
  insert into public.subject_offering_syllabus values(o,doc);
  perform public._t('draft-only corpus excluded',public.resolve_syllabus_retrieval_scope(p)->>'reason'='draft_only');
  update public.syllabus_document set status='verified',verified_at=now(),verified_by='synthetic test' where id=doc;
  perform public._t('verification is not licensing',public.resolve_syllabus_retrieval_scope(p)->>'reason'='unlicensed');
  update public.paper set exam_date='2024-06-01' where id=p;
  perform public._t('wrong year never falls back to latest',public.resolve_syllabus_retrieval_scope(p)->>'reason'='outside_validity');
  update public.paper set exam_date='2026-06-01' where id=p;
  insert into public.syllabus_document(provider_key,syllabus_code,title,version_label,valid_from_year,valid_to_year,
    source_url,source_sha256,fetched_at,status,verified_at)
  values('cbse','AXO226','Synthetic other version','test-v2',2025,2027,
    'https://example.invalid/axo226-v2',repeat('b',64),now(),'verified',now()) returning id into other_doc;
  insert into public.subject_offering_syllabus values(o,other_doc);
  perform public._t('overlapping verified versions abstain',public.resolve_syllabus_retrieval_scope(p)->>'reason'='version_ambiguous');
  delete from public.subject_offering_syllabus where subject_offering_id=o and document_id=other_doc;
  insert into public.syllabus_topic(document_id,code,title,kind,sort_order,depth,source_page)
  values(doc,'1','Synthetic mechanics','unit',1,0,1) returning id into parent;
  insert into public.syllabus_topic(document_id,parent_id,code,title,kind,objective_text,sort_order,depth,source_page)
  values(doc,parent,'1.1','Synthetic motion','objective','Describe synthetic orbital motion.',2,1,2) returning id into objective;
  insert into public.syllabus_topic(document_id,code,title,kind,objective_text,sort_order,depth,source_page,qualification_scope)
  values(doc,'1.2','Synthetic motion','objective','Advanced orbital motion.',3,1,2,'A'),
    (doc,'1.3','Synthetic motion','objective','Missing page orbital motion.',4,1,null,null),
    (other_doc,'1.1','Cross-version motion','objective','Cross-version orbital motion.',1,1,1,null);
  insert into public.syllabus_topic(document_id,code,title,kind,sort_order,depth,source_page)
  values(other_doc,'1','Wrong parent','unit',2,0,1) returning id into wrong_parent;
  insert into private.syllabus_retrieval_approval(subject_offering_id,document_id,programme_id,stage_id,subject_code,
    source_sha256,version_label,source_url,valid_from_year,valid_to_year,qualification_scopes,
    rights_basis,approval_reference,approved_by)
  select o,doc,so.programme_id,so.stage_id,so.external_code,d.source_sha256,d.version_label,d.source_url,
    d.valid_from_year,d.valid_to_year,array[''],'SYNTHETIC TEST ONLY','test fixture','test runner'
  from public.subject_offering so cross join public.syllabus_document d where so.id=o and d.id=doc;
  perform public._t('explicit applicable approval resolves',public.resolve_syllabus_retrieval_scope(p)->>'status'='available');
  result := public.search_syllabus_topics(p,doc,repeat('a',64),'orbital motion');
  perform public._t('only eligible objective survives version, tier, kind and page filters',
    jsonb_array_length(result->'candidates')=1 and result->'candidates'->0->>'objective_id'=objective::text);
  perform public._t('same-document parent context and source page retained',
    result->'candidates'->0->'parent'->>'id'=parent::text and result->'candidates'->0->>'source_page'='2');
  perform public._t('exact code lookup supported',jsonb_array_length(public.search_syllabus_topics(p,doc,repeat('a',64),'1.1')->'candidates')=1);
  perform public._t('foreign document pin rejected',public.search_syllabus_topics(p,other_doc,repeat('b',64),'motion')->>'reason'='scope_changed');
  perform public._t('stale hash pin rejected',public.search_syllabus_topics(p,doc,repeat('b',64),'motion')->>'reason'='scope_changed');
  perform public._t('empty lexical result is not an invented topic',jsonb_array_length(public.search_syllabus_topics(p,doc,repeat('a',64),'nonexistent')->'candidates')=0);
  perform public._t('hostile query remains data',jsonb_array_length(public.search_syllabus_topics(p,doc,repeat('a',64),''' ; SELECT * FROM public.paper; --')->'candidates')=0);
  perform public._t('oversized query rejected',public.search_syllabus_topics(p,doc,repeat('a',64),repeat('x',513))->>'reason'='invalid_query');
  perform public._t('top-k cannot be unbounded',public.search_syllabus_topics(p,doc,repeat('a',64),'motion',21)->>'reason'='invalid_query');
  perform public._t('null/blank query rejected',public.search_syllabus_topics(p,doc,repeat('a',64),null)->>'reason'='invalid_query'
    and public.search_syllabus_topics(p,doc,repeat('a',64),'   ')->>'reason'='invalid_query');
  update public.syllabus_topic set parent_id=wrong_parent where id=objective;
  perform public._t('parsed corpus mutation revokes approval',public.resolve_syllabus_retrieval_scope(p)->>'reason'='unlicensed');
  update private.syllabus_retrieval_approval set revoked_at=null where document_id=doc;
  perform public._t('cross-document parent never returned',public.search_syllabus_topics(p,doc,repeat('a',64),'motion')->'candidates'->0->'parent'='null'::jsonb);
  update public.syllabus_document set source_sha256=repeat('c',64) where id=doc;
  update private.syllabus_retrieval_approval set revoked_at=null where document_id=doc;
  perform public._t('changed source hash fails even with revoked flag reset',public.resolve_syllabus_retrieval_scope(p)->>'reason'='unlicensed');
  update public.syllabus_document set source_sha256=repeat('a',64) where id=doc;
  perform public._t('restoring source does not restore approval',public.resolve_syllabus_retrieval_scope(p)->>'reason'='unlicensed');
  update private.syllabus_retrieval_approval set revoked_at=null where document_id=doc;
  update public.syllabus_document set valid_from_year=null where id=doc;
  perform public._t('unknown validity is not unlimited',public.resolve_syllabus_retrieval_scope(p)->>'reason'='outside_validity');
  update public.syllabus_document set valid_from_year=2025 where id=doc;
  update private.syllabus_retrieval_approval set revoked_at=null where document_id=doc;
  insert into public.assessment_identity(programme_id,subject_offering_id,exam_year,title)
  select programme_id,id,2025,'Synthetic assessment' from public.subject_offering where id=o returning id into identity_id;
  update public.paper set assessment_identity_id=identity_id where id=p;
  perform public._t('conflicting exam years abstain',public.resolve_syllabus_retrieval_scope(p)->>'reason'='exam_year_ambiguous');
  update public.paper set exam_date=null where id=p;
  perform public._t('assessment exam year can resolve without upload date',public.resolve_syllabus_retrieval_scope(p)->>'exam_year'='2025');
  update public.assessment_identity set subject_offering_id=null where id=identity_id;
  perform public._t('unbound assessment cannot resolve another subject',public.resolve_syllabus_retrieval_scope(p)->>'reason'='subject_unresolved');
  update public.paper set assessment_identity_id=null,exam_date='2026-06-01' where id=p;
  update public.subject_offering set levels_supported=array['SL','HL'] where id=o;
  perform public._t('unknown qualification level abstains',public.resolve_syllabus_retrieval_scope(p)->>'reason'='qualification_unresolved');
  update public.subject_offering set levels_supported='{}',external_code='CHANGED' where id=o;
  perform public._t('changed offering code cannot inherit approval',public.resolve_syllabus_retrieval_scope(p)->>'reason'='missing');
end;
$$;

select public._t('runtime cannot approve corpus',not has_table_privilege('service_role','private.syllabus_retrieval_approval','insert,update,delete'));
select public._t('RPC restricted to service role',
  has_function_privilege('service_role','public.search_syllabus_topics(uuid,uuid,text,text,integer)','execute')
  and not has_function_privilege('anon','public.search_syllabus_topics(uuid,uuid,text,text,integer)','execute')
  and not has_function_privilege('authenticated','public.resolve_syllabus_retrieval_scope(uuid)','execute'));
set local role anon;
do $$ begin
  perform public.resolve_syllabus_retrieval_scope('a2260000-0000-4000-8000-000000000004');
  perform public._t('actual anonymous call denied',false);
exception when insufficient_privilege then perform public._t('actual anonymous call denied',true); end $$;
reset role;
set local role authenticated;
do $$ begin
  perform public.search_syllabus_topics('a2260000-0000-4000-8000-000000000004',null,null,'motion');
  perform public._t('actual authenticated search denied',false);
exception when insufficient_privilege then perform public._t('actual authenticated search denied',true); end $$;
reset role;
select count(*) as total,count(*) filter(where passed) as passed,count(*) filter(where passed is not true) as failed from public._r;
select name,detail from public._r where passed is not true;
rollback;
