import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const url = process.env.AXON_LOCAL_TEST_DB_URL;
assert(url && new URL(url).hostname === "127.0.0.1", "Concurrency regression requires the throwaway local Supabase database");
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [url, "-X", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-c", query]);
    let out = "", err = "";
    child.stdout.on("data", data => out += data);
    child.stderr.on("data", data => err += data);
    child.on("error", reject);
    child.on("close", code => resolve({ code, out, err }));
  });
}
const suite = readFileSync("supabase/tests/axo_124_no_printed_total.sql", "utf8");
const fixture = suite.slice(0, suite.indexOf("select public.commit_extraction_run"));
const setup = fixture + `
insert into private.student_scope_session(guardian_id,auth_session_id,student_id,expires_at)
values ('aaaaaaaa-0000-4000-8000-000000000001','audit-race','aaaaaaaa-0000-4000-8000-000000000002',now()+interval '15 minutes');
insert into public.region_explanation(region_id,run_id,student_id,tier,cause,marks_lost,body,do_this_next,model_version,prompt_version,grounding_status)
values ('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-000000000002','tier_1','procedural_slip',1,'Fixture explanation','Check the formula','fixture','fixture','complete'),
('aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-000000000002','tier_1','procedural_slip',2,'Fixture explanation','Check the formula','fixture','fixture','complete');
create function public._audit_pause() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end; $$;
create trigger audit_pause before insert on public.student_attempt for each row execute function public._audit_pause();
commit;
`;
try {
  const created = await sql(setup);
  assert.equal(created.code, 0, created.err);
  const commit = `begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"audit-race"}',true);
select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b1'); commit;`;
  const results = await Promise.all([sql(commit), sql(commit)]);
  assert.equal(results.filter(r => r.code === 0).length, 1, JSON.stringify(results));
  assert.match(results.find(r => r.code !== 0).err, /23505.*already committed/);
  const counts = await sql(`select
    (select count(*) from public.student_attempt where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1'),
    (select count(*) from public.mark_loss_event where attempt_id in (select id from public.student_attempt where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1')),
    (select total_awarded from public.paper where id='aaaaaaaa-0000-4000-8000-0000000000a1');`);
  assert.equal(counts.code, 0, counts.err);
  assert.equal(counts.out.trim(), "2|2|7.00");
  console.log("PASS: concurrent authenticated saves created one set of attempts, loss events and totals");
} finally {
  const cleaned = await sql(`begin;
drop trigger if exists audit_pause on public.student_attempt;
drop function if exists public._audit_pause();
-- The database is explicitly localhost and disposable. Remove only this fixture's
-- append-only consent rows inside a transaction, restoring triggers before commit.
alter table public.consent_event disable trigger user;
delete from public.consent_event where guardian_id='aaaaaaaa-0000-4000-8000-000000000001';
alter table public.consent_event enable trigger user;
delete from public.guardian where id='aaaaaaaa-0000-4000-8000-000000000001';
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
drop function if exists public._region(uuid,uuid,uuid,integer,numeric,numeric,text);
drop function if exists public._t(text,boolean,text);
drop table if exists public._r;
commit;`);
  assert.equal(cleaned.code, 0, cleaned.err);
}
