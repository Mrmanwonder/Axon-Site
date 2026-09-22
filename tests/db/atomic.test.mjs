import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('profile and linked-paper transactions are atomic, scoped and idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function private.current_guardian_id() returns uuid language sql as $$select auth.uid()$$;
      create type public.board as enum ('CAIE');
      create type public.paper_type as enum ('unit_test','pyq','sample_paper');
      create type public.paper_tier as enum ('tier_1','tier_2');
      create table public.student(id uuid primary key, guardian_id uuid not null, first_name text not null, class_level smallint, board public.board, age_band text);
      create table public.student_subject(student_id uuid references public.student, subject text, syllabus_code text, primary key(student_id,subject));
      create table public.paper(id uuid primary key, student_id uuid references public.student, type public.paper_type, tier public.paper_tier, date_taken date);
      create table public.paper_page(paper_id uuid references public.paper, student_id uuid, page_number integer, source_kind text, source_url text check(source_url <> 'https://reject.test'), status text);
      alter table public.student enable row level security;
      create policy own_student on public.student to authenticated using(guardian_id = auth.uid()) with check(guardian_id = auth.uid());
      alter table public.paper enable row level security;
      create policy own_paper on public.paper to authenticated using(exists(select 1 from public.student where id=student_id)) with check(exists(select 1 from public.student where id=student_id));
      grant usage on schema public,private,auth to authenticated;
      grant select,insert on all tables in schema public to authenticated;
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/20260912040233_frontend_atomic_mutations.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    const id = '10000000-0000-0000-0000-000000000001';
    const create = subjects => db.query('select create_student_profile($1,$2,11::smallint,$3,$4) as profile', [id,'Sam','CAIE',JSON.stringify(subjects)]);
    const subject = { subject: 'Physics', syllabus_code: '9702' };
    await assert.rejects(create([subject,subject])); // failure after the student insert
    assert.equal((await db.query('select count(*)::int as n from student')).rows[0].n, 0);
    await assert.rejects(create([{subject:'Physics',syllabus_code:'0000'}]));
    for (let n=0;n<10;n++) assert.equal((await create([subject])).rows[0].profile.id,id);
    assert.equal((await db.query('select count(*)::int as n from student')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from student_subject')).rows[0].n,1);
    const paperId = '20000000-0000-0000-0000-000000000001';
    const link = url => db.query('select (create_link_paper($1,$2,$3,$4,$5)).id', [paperId,id,'unit_test','2026-09-12',url]);
    await assert.rejects(link('https://reject.test'));
    assert.equal((await db.query('select count(*)::int as n from paper')).rows[0].n,0);
    await link('https://example.test/paper'); await link('https://example.test/paper');
    assert.equal((await db.query('select count(*)::int as n from paper_page')).rows[0].n,1);
    await assert.rejects(db.query('select create_link_paper($1,$2,$3,$4,$5)', ['20000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','unit_test','2026-09-12','https://example.test']));
  } finally { await db.close(); }
});
