import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('IB school IGCSE profiles persist canonical Cambridge identity, retry safely, and enforce ownership', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function private.current_guardian_id() returns uuid language sql as $$select auth.uid()$$;
      create type public.board as enum ('CAIE','CBSE');
      create table curriculum_provider(id uuid primary key default gen_random_uuid(),key text,name text,active boolean default true);
      create table curriculum_programme(id uuid primary key default gen_random_uuid(),provider_id uuid,key text,label text,active boolean default true);
      create table curriculum_stage(id uuid primary key default gen_random_uuid(),programme_id uuid,key text,label text,school_year_label text,legacy_class_level smallint,active boolean default true);
      create table curriculum_source(provider_id uuid,version_label text,active boolean);
      create table subject_offering(id uuid primary key default gen_random_uuid(),programme_id uuid,stage_id uuid,display_name text,external_code text,external_code_kind text,levels_supported text[] default '{}',availability text default 'active');
      create table student(id uuid primary key,guardian_id uuid,first_name text,board public.board,class_level smallint,age_band text,avatar_seed text,programme_id uuid,stage_id uuid,curriculum_version text,updated_at timestamptz);
      create table student_subject(student_id uuid,subject text,syllabus_code text,subject_offering_id uuid,selected_level text,display_name_snapshot text,external_code_snapshot text,primary key(student_id,subject_offering_id));
      create table paper(student_id uuid);
      alter table student enable row level security;
      create policy own_student on student to authenticated using(guardian_id=auth.uid()) with check(guardian_id=auth.uid());
      alter table student_subject enable row level security;
      create policy own_subject on student_subject to authenticated using(exists(select 1 from student where id=student_id)) with check(exists(select 1 from student where id=student_id));
      grant usage on schema public,private,auth to authenticated;
      grant select,insert,update,delete on all tables in schema public to authenticated;
      insert into curriculum_provider(key,name) values('cambridge','Cambridge'),('ib','IB Diploma');
      insert into curriculum_programme(provider_id,key,label) select id,'cambridge_igcse','IGCSE' from curriculum_provider where key='cambridge';
      insert into curriculum_programme(provider_id,key,label) select id,'ibdp','DP' from curriculum_provider where key='ib';
      insert into curriculum_stage(programme_id,key,label,legacy_class_level) select id,'cambridge_igcse_y10','IGCSE',9 from curriculum_programme where key='cambridge_igcse';
      insert into curriculum_stage(programme_id,key,label,legacy_class_level) select id,'cambridge_igcse_y11','IGCSE',10 from curriculum_programme where key='cambridge_igcse';
      insert into curriculum_stage(programme_id,key,label,legacy_class_level) select id,'ibdp_1','DP1',11 from curriculum_programme where key='ibdp';
      insert into subject_offering(programme_id,stage_id,display_name,external_code,external_code_kind) select programme_id,id,'Mathematics','0580','syllabus_code' from curriculum_stage where key like 'cambridge%';
      insert into subject_offering(programme_id,stage_id,display_name,external_code,external_code_kind,levels_supported) select programme_id,id,'Mathematics AA','MATH','subject_code',array['SL','HL'] from curriculum_stage where key='ibdp_1';
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/20260923164732_profile_rpc_v2.sql',import.meta.url),'utf8'));
    // The release writes this file using the migration version allocated by Supabase.
    const { readdir } = await import('node:fs/promises');
    const directory = new URL('../../supabase/migrations/',import.meta.url);
    const migration = (await readdir(directory)).find(name=>name.endsWith('_axo_186_school_exam_pathway.sql'));
    assert.ok(migration, 'school pathway migration is checked in');
    await db.exec(await readFile(new URL(migration,directory),'utf8'));
    await db.exec(`create function private.guardian_is_pro(uuid) returns boolean language sql as $$select false$$;`);
    const retryMigration = (await readdir(directory)).find(name=>name.endsWith('_axo_187_idempotent_profile_retry.sql'));
    assert.ok(retryMigration, 'idempotent retry migration is checked in');
    await db.exec(await readFile(new URL(retryMigration,directory),'utf8'));
    await db.exec(`create trigger student_profile_limit before insert on student for each row execute function private.enforce_student_profile_limit();`);
    const subjects = async stage => (await db.query(`select jsonb_agg(jsonb_build_object('offering_id',o.id,'level',case when s.key='ibdp_1' then 'HL' end)) as subjects from subject_offering o join curriculum_stage s on s.id=o.stage_id where s.key=$1`,[stage])).rows[0].subjects;
    const y9 = await subjects('cambridge_igcse_y10');
    const y10 = await subjects('cambridge_igcse_y11');
    const dp = await subjects('ibdp_1');
    await db.exec(`set test.uid='00000000-0000-0000-0000-000000000001';set role authenticated;`);
    const id='10000000-0000-0000-0000-000000000001';
    const create=()=>db.query('select create_student_profile_v2($1,$2,$3,$4,$5,$6::jsonb,$7) as profile',[id,'Sam','cambridge_igcse','cambridge_igcse_y10','dreamBloom',JSON.stringify(y9),'ib_school_igcse']);
    for(let i=0;i<3;i++) {
      const profile=(await create()).rows[0].profile;
      assert.equal(profile.provider_key,'cambridge');
      assert.equal(profile.school_pathway,'ib_school_igcse');
      assert.equal(profile.class_level,9);
      assert.equal(profile.subjects[0].external_code,'0580');
      assert.equal(profile.subjects[0].level,null);
    }
    assert.equal((await db.query('select count(*)::int n from student')).rows[0].n,1);
    await assert.rejects(db.query('select create_student_profile_v2($1,$2,$3,$4,$5,$6::jsonb,$7)',[
      '10000000-0000-0000-0000-000000000002','Second Student','cambridge_igcse',
      'cambridge_igcse_y10','dreamBloom',JSON.stringify(y9),'ib_school_igcse',
    ]), /Free includes/);
    const update=(programme,stage,sub,path)=>db.query('select update_student_profile_v2($1,$2,$3,$4,$5,$6::jsonb,$7) as profile',[id,'Sam',programme,stage,'dreamBloom',JSON.stringify(sub),path]);
    const updated=(await update('cambridge_igcse','cambridge_igcse_y11',y10,'ib_school_igcse')).rows[0].profile;
    assert.equal(updated.class_level,10); assert.equal(updated.school_pathway,'ib_school_igcse');
    await assert.rejects(update('ibdp','ibdp_1',dp,'ib_school_igcse'));
    assert.equal((await db.query('select class_level from student')).rows[0].class_level,10);
    await db.exec(`set test.uid='00000000-0000-0000-0000-000000000002'`);
    await assert.rejects(update('cambridge_igcse','cambridge_igcse_y11',y10,'ib_school_igcse'));
    await db.exec(`set test.uid='00000000-0000-0000-0000-000000000001'`);
    const advanced=(await update('ibdp','ibdp_1',dp,null)).rows[0].profile;
    assert.equal(advanced.provider_key,'ib'); assert.equal(advanced.school_pathway,null);
    assert.equal(advanced.subjects[0].level,'HL');
  } finally { await db.close(); }
});
