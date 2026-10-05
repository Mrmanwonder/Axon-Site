#!/usr/bin/env node
// Syllabus ingest: fetch each official PDF in curriculum/syllabi/sources.json,
// check its SHA-256 against the manifest, extract text with extract.py (which
// keeps mathematical notation readable; see that file), parse it with the
// board's parser, audit every objective against the source, and write SQL
// that loads the topic tree as a DRAFT.
//
//   node scripts/syllabus/ingest.mjs [--code 9709] --out /tmp/syllabus.sql
//
// Requires python3 with scripts/syllabus/requirements.txt installed. Nothing
// is committed: the SQL goes to --out and is applied by a person (or psql
// against SUPABASE_DB_URL).
//
// Ids are deterministic (a hash of provider, code, version, kind and topic
// code), so a re-ingest of the same edition updates rows in place and keeps
// every question's topic tags. A verified document is never overwritten;
// a changed edition is a new manifest entry and a new document.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCambridgeSyllabus, auditParse } from "./cambridge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PARSERS = { cambridge: parseCambridgeSyllabus };
/** Bumped when extract.py changes what it writes, so a re-load retags. */
const EXTRACTOR = "extract.py/2";

export function stableId(...parts) {
  const h = createHash("sha256").update(parts.join("\u0000")).digest("hex");
  // Shaped as a version-5-style UUID so Postgres accepts it.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

/** First sentence-ish slice of an objective, for a compact label. The full text is kept separately. */
export function shortTitle(text) {
  if (text.length <= 90) return text;
  const cut = text.slice(0, 90);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

/** Builds the rows for one parsed document. Pure, so it can be tested. */
export function rowsFor(doc, parsed) {
  const docId = stableId(doc.provider_key, doc.syllabus_code, doc.version_label);
  const rows = [];
  let order = 0;
  for (const u of parsed.units) {
    const unitId = stableId(docId, "unit", u.code);
    rows.push({ id: unitId, parent_id: null, code: u.code, kind: "unit", title: u.title, objective_text: null, notes_text: null, group_title: null, scope: u.scope, sort_order: order++, depth: 0, page: u.topics[0]?.page ?? null });
    for (const t of u.topics) {
      const topicId = stableId(docId, "topic", t.code);
      rows.push({ id: topicId, parent_id: unitId, code: t.code, kind: "topic", title: t.title, objective_text: null, notes_text: null, group_title: null, scope: t.scope ?? u.scope, sort_order: order++, depth: 1, page: t.page });
      for (const o of t.objectives) {
        rows.push({ id: stableId(docId, "objective", o.code), parent_id: topicId, code: o.code, kind: "objective", title: shortTitle(o.text), objective_text: o.text, notes_text: o.notes, group_title: o.group, scope: t.scope ?? u.scope, sort_order: order++, depth: 2, page: o.page });
      }
    }
  }
  return { docId, rows };
}

/** A short fingerprint of everything a student or the tagger reads. */
export function contentHash(rows) {
  return createHash("sha256").update(JSON.stringify(rows.map((r) => [r.id, r.code, r.title, r.objective_text]))).digest("hex").slice(0, 16);
}

export function sqlFor(doc, parsed, fetchedAt) {
  const { docId, rows } = rowsFor(doc, parsed);
  const notes = `parser=${doc.parser} extractor=${EXTRACTOR} style=${parsed.style} content=${contentHash(rows)}`;
  const values = rows.map((r) =>
    `(${q(r.id)}, ${q(docId)}, ${q(r.parent_id)}, ${q(r.code)}, ${q(r.kind)}, ${q(r.title)}, ${q(r.objective_text)}, ${q(r.notes_text)}, ${q(r.group_title)}, ${q(r.scope)}, ${r.sort_order}, ${r.depth}, ${r.page ?? "null"})`);
  return `-- ${doc.title} ${doc.syllabus_code} (${doc.version_label}) · ${rows.length} rows · sha256 ${doc.source_sha256}
do $$
begin
  if exists (select 1 from public.syllabus_document where id = ${q(docId)} and status <> 'draft') then
    raise notice 'syllabus ${doc.syllabus_code} ${doc.version_label} is not a draft; left unchanged';
    return;
  end if;
  -- The objective text changed since the last load (a parser fix, say): the
  -- model's tags were chosen against the old text, so they are dropped and
  -- the sweep tags the questions again. A tag a student rejected stays.
  if exists (select 1 from public.syllabus_document where id = ${q(docId)} and extraction_notes is distinct from ${q(notes)}) then
    delete from public.region_topic rt using public.syllabus_topic t
     where rt.topic_id = t.id and t.document_id = ${q(docId)} and rt.source = 'model' and rt.student_rejected_at is null;
    delete from private.topic_tag_job where document_id = ${q(docId)};
  end if;
  insert into public.syllabus_document (id, provider_key, syllabus_code, title, version_label, valid_from_year, valid_to_year, source_url, source_sha256, fetched_at, status, extraction_notes)
  values (${q(docId)}, ${q(doc.provider_key)}, ${q(doc.syllabus_code)}, ${q(doc.title)}, ${q(doc.version_label)}, ${doc.valid_from_year ?? "null"}, ${doc.valid_to_year ?? "null"}, ${q(doc.source_url)}, ${q(doc.source_sha256)}, ${q(fetchedAt)}, 'draft', ${q(notes)})
  on conflict (id) do update set title = excluded.title, source_url = excluded.source_url, source_sha256 = excluded.source_sha256, fetched_at = excluded.fetched_at, extraction_notes = excluded.extraction_notes, updated_at = now();
  delete from public.syllabus_topic where document_id = ${q(docId)} and id <> all (array[${rows.map((r) => q(r.id)).join(",")}]::uuid[]);
  insert into public.syllabus_topic (id, document_id, parent_id, code, kind, title, objective_text, notes_text, group_title, qualification_scope, sort_order, depth, source_page)
  values
  ${values.join(",\n  ")}
  on conflict (id) do update set parent_id = excluded.parent_id, code = excluded.code, kind = excluded.kind, title = excluded.title, objective_text = excluded.objective_text, notes_text = excluded.notes_text, group_title = excluded.group_title, qualification_scope = excluded.qualification_scope, sort_order = excluded.sort_order, depth = excluded.depth, source_page = excluded.source_page;
  insert into public.subject_offering_syllabus (subject_offering_id, document_id)
  select so.id, ${q(docId)}
  from public.subject_offering so
  join public.curriculum_programme pr on pr.id = so.programme_id
  join public.curriculum_provider cp on cp.id = pr.provider_id
  where cp.key = ${q(doc.provider_key)} and so.external_code = ${q(doc.syllabus_code)}
  on conflict do nothing;
end $$;
`;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--code") ? args[args.indexOf("--code") + 1] : null;
  const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
  const manifest = JSON.parse(readFileSync(join(ROOT, "curriculum/syllabi/sources.json"), "utf8"));
  const work = mkdtempSync(join(tmpdir(), "axon-syllabus-"));
  const chunks = [];
  let failed = false;
  for (const doc of manifest.documents) {
    if (only && doc.syllabus_code !== only) continue;
    const res = await fetch(doc.source_url);
    if (!res.ok) { console.error(`${doc.syllabus_code}: download failed, HTTP ${res.status}`); failed = true; continue; }
    const bytes = Buffer.from(await res.arrayBuffer());
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== doc.source_sha256) {
      console.error(`${doc.syllabus_code}: SHA-256 ${sha} does not match the manifest. The board has published a different file; add it as a new edition after checking it.`);
      failed = true; continue;
    }
    const pdf = join(work, `${doc.syllabus_code}.pdf`);
    writeFileSync(pdf, bytes);
    const text = execFileSync("python3", [join(ROOT, "scripts/syllabus/extract.py"), pdf], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const parsed = PARSERS[doc.parser](text);
    const audit = auditParse(parsed, text);
    console.error(`${doc.syllabus_code} ${doc.version_label}: ${audit.units} units, ${audit.topics} topics, ${audit.objectives} objectives, ${audit.problems.length} problems`);
    if (audit.problems.length) { for (const p of audit.problems) console.error(`  ${p}`); failed = true; continue; }
    chunks.push(sqlFor(doc, parsed, new Date().toISOString()));
  }
  const sql = chunks.join("\n");
  if (out) writeFileSync(out, sql); else process.stdout.write(sql);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
