// Parser for Cambridge International AS & A Level syllabus PDFs, from the text
// `pdftotext -layout` produces. Pure: text in, topic tree out. No network, no
// model, so every objective it returns is the board's own wording.
//
// Three layouts are handled, all seen in current syllabi:
//   bullets   "•" items, notes in a right-hand column   (9709, 9231)
//   numbered  "1", "2", ... items, single column        (9702)
//   plain     one sentence per item, notes column       (9618)
//
// A unit is "1   Pure Mathematics 1 (for Paper 1)"; a topic is "1.1 Quadratics";
// objectives follow "Candidates should be able to:". The right-hand column
// ("Notes and examples" / "Notes and guidance") is split off by the header's
// own column position on each page.

const TOPIC_RE = /^\s{0,16}(\d{1,2})\.(\d{1,2})\s+(\S.*?)\s*$/;
const UNIT_RE = /^\s{0,16}(\d{1,2})\s{1,8}([A-Z][^•]*?)\s*$/;
/** Running header on every page of the subject content section. */
const CONTENT_PAGE_RE = /syllabus for [^\n]*\.\s*Subject content/;
const HEADER_RE = /Candidates should be able to:?/;
const NOTES_RE = /Notes and (examples|guidance)/;
const NOISE_RE = /^(Back to contents page|www\.cambridgeinternational\.org|Cambridge International (AS & A Level|IGCSE)|© )/;
const SCOPE_RE = /^\s*(AS Level|AS|A Level) (?:subject )?content\s*$/;
const SECTION_RE = /^\s*\d\s+Subject content\s*$/m;

const clean = (s) => s.replace(/\t/g, " ").replace(/\s+/g, " ").trim();

/**
 * Where the notes column starts on this line. Column starts drift by a
 * character or two between pages, so the split is the run of two or more
 * spaces nearest the header's column, not the column itself.
 */
function splitAt(line, col) {
  if (col === null || line.length <= col - 6) return line.length;
  let best = null;
  const gap = /\s{2,}/g;
  let m;
  while ((m = gap.exec(line))) {
    const end = m.index + m[0].length;
    if (m.index === 0) continue;
    if (Math.abs(end - col) <= 8 && (best === null || Math.abs(end - col) < Math.abs(best - col))) best = end;
  }
  if (best !== null) return best;
  // No gap near the column: the left text runs into it, or there is no right text.
  return line.slice(0, col).trim().length && /\S/.test(line[col - 1] ?? "") ? line.length : col;
}

/** A trailing run of digits after a wide gap is a contents-page number, not a heading. */
const looksLikeContentsLine = (raw) => /\S\s{3,}\d{1,3}\s*$/.test(raw);

export function parseCambridgeSyllabus(text) {
  const pages = text.split("\f");
  const units = new Map();
  let unit = null;
  let topic = null;
  let collecting = false;
  let notesCol = null;
  let scope = null;
  let style = null;
  let current = null; // objective being built
  let pendingGroup = null;
  let blankRun = 0;

  const unitFor = (code, title) => {
    if (!units.has(code)) units.set(code, { code, title, scope, topics: new Map() });
    return units.get(code);
  };
  const close = () => {
    if (current && topic) {
      current.text = clean(current.parts.join(" "));
      current.notes = clean(current.notes.join(" ")) || null;
      delete current.parts;
      if (current.text) topic.objectives.push(current);
    }
    current = null;
  };

  pages.forEach((page, pageIndex) => {
    const pageNo = pageIndex + 1;
    if (!CONTENT_PAGE_RE.test(page) && !SECTION_RE.test(page)) return;
    // An objective list never runs across a page break without its header
    // being repeated, so a new page starts outside any list. This keeps tables
    // that follow a list (the 9618 instruction set) out of the objectives.
    close(); collecting = false;
    for (const raw of page.split("\n")) {
      const line = raw.replace(/\t/g, "    ");
      const trimmed = line.trim();
      if (!trimmed) { blankRun += 1; continue; }
      const gapBefore = blankRun; blankRun = 0;
      if (NOISE_RE.test(trimmed) || /^\d{1,3}$/.test(trimmed)) continue;

      const scopeMatch = line.match(SCOPE_RE);
      if (scopeMatch) { close(); scope = scopeMatch[1].startsWith("AS") ? "AS" : "A"; collecting = false; continue; }

      const t = !looksLikeContentsLine(line) && line.match(TOPIC_RE);
      if (t && !HEADER_RE.test(line)) {
        close();
        const u = unitFor(t[1], unit?.code === t[1] ? unit.title : `Unit ${t[1]}`);
        unit = u;
        const code = `${t[1]}.${t[2]}`;
        const title = clean(t[3].replace(/\s+continued$/i, ""));
        if (!u.topics.has(code)) u.topics.set(code, { code, title, scope: u.scope ?? scope, page: pageNo, objectives: [] });
        topic = u.topics.get(code);
        collecting = false; pendingGroup = null;
        continue;
      }

      const um = !looksLikeContentsLine(line) && line.match(UNIT_RE);
      if (um && !HEADER_RE.test(line) && !/^Subject content$/i.test(clean(um[2])) && um[2].length >= 3 && um[2].length <= 90) {
        close();
        const title = clean(um[2]);
        const u = unitFor(um[1], title);
        if (u.title.startsWith("Unit ")) u.title = title;
        if (!u.scope && scope) u.scope = scope;
        unit = u; topic = null; collecting = false;
        continue;
      }

      if (HEADER_RE.test(line)) {
        close();
        // A one-line item just before a header is a sub-heading ("Sound"), not an objective.
        if (style === "plain" && topic && topic.objectives.length) {
          const last = topic.objectives[topic.objectives.length - 1];
          if (!last.notes && last.text.split(" ").length <= 4 && !/[.:;]$/.test(last.text)) { topic.objectives.pop(); pendingGroup = last.text; }
        }
        const n = line.search(NOTES_RE);
        notesCol = n >= 0 ? n : null;
        collecting = !!topic;
        continue;
      }
      if (!collecting || !topic) {
        // Sub-heading lines between objective blocks (plain layout).
        if (topic && style === "plain" && !HEADER_RE.test(line)) pendingGroup = clean(line);
        continue;
      }

      // Tables inside a topic (opcode lists) are not objectives.
      if (/^\s*(Label\s+)?Opcode\b|^\s*Instruction\s{3,}Explanation|^\s*The following table/.test(line)) { close(); collecting = false; continue; }
      let cut = splitAt(line, notesCol);
      // A bullet that opens a notes-column list belongs to the notes.
      const stray = line.slice(0, cut).match(/(?:^|\s{2,})[•▪●–-]\s*$/);
      if (notesCol !== null && style === "plain" && stray) cut = stray.index + (stray[0].match(/^\s*/)?.[0].length ?? 0);
      const left = line.slice(0, cut);
      const right = line.slice(cut);
      const l = left.trim();
      const r = right.trim();

      const bullet = l.match(/^[•▪●]\s*(.*)$/);
      const numbered = l.match(/^(\d{1,2})\s+(\S.*)$/);
      if (!style) style = bullet ? "bullets" : numbered ? "numbered" : "plain";

      let startsNew = false;
      let body = l;
      if (style === "bullets" && bullet) { startsNew = true; body = bullet[1]; }
      else if (style === "numbered" && numbered && Number(numbered[1]) === topic.objectives.length + (current ? 2 : 1)) { startsNew = true; body = numbered[2]; }
      else if (style === "plain" && l && /^[A-Z]/.test(l) && !/^[A-Z]{2,}\b/.test(l)) { startsNew = true; }
      else if (style === "plain" && l && /^[A-Z]{2,}\b/.test(l) && (!current || gapBefore > 0)) { startsNew = true; }

      if (startsNew) {
        close();
        current = { code: null, text: "", parts: body ? [body] : [], notes: r ? [r] : [], group: pendingGroup, page: pageNo, subheadingCandidate: false };
        continue;
      }
      if (!current) {
        if (r && topic.objectives.length) topic.objectives.at(-1).notes = clean(`${topic.objectives.at(-1).notes ?? ""} ${r}`);
        continue;
      }
      if (l) current.parts.push(l);
      if (r) current.notes.push(r);
    }
  });
  close();

  // Number objectives within each topic and drop empty structure.
  const out = [];
  for (const u of units.values()) {
    const topics = [];
    for (const tp of u.topics.values()) {
      tp.objectives = tp.objectives.map((o, i) => ({
        code: `${tp.code}.${i + 1}`, text: o.text, notes: o.notes, group: o.group ?? null, page: o.page,
      }));
      if (tp.objectives.length) topics.push(tp);
    }
    if (topics.length) out.push({ code: u.code, title: u.title, scope: u.scope ?? null, topics });
  }
  return { style, units: out };
}

const words = (s) => s.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Checks a parse against its source before anything is stored. Two-column
 * text interleaves on the page, so an objective is accepted when its words
 * occur in the source in the same order, within a window a few times its own
 * length. That proves no word was invented or reordered.
 */
export function auditParse(parsed, text) {
  const source = words(text);
  const index = new Map();
  source.forEach((w, i) => { if (!index.has(w)) index.set(w, []); index.get(w).push(i); });
  const problems = [];
  let objectives = 0;
  for (const u of parsed.units) for (const t of u.topics) {
    for (const o of t.objectives) {
      objectives += 1;
      const ws = words(o.text);
      const window = ws.length * 10 + 80;
      const found = (index.get(ws[0]) ?? []).some((start) => {
        let at = start;
        for (const w of ws.slice(1)) {
          const next = (index.get(w) ?? []).find((i) => i > at);
          if (next === undefined || next - start > window) return false;
          at = next;
        }
        return true;
      });
      if (!found) problems.push(`${o.code} words not found in order in the source: "${o.text.slice(0, 70)}"`);
      if (o.text.length < 8) problems.push(`${o.code} is suspiciously short: "${o.text}"`);
      if (o.text.length > 800) problems.push(`${o.code} is suspiciously long (${o.text.length} chars)`);
    }
  }
  return { units: parsed.units.length, topics: parsed.units.reduce((n, u) => n + u.topics.length, 0), objectives, problems };
}
