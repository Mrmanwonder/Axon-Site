// General parser for Cambridge syllabus "Subject content" sections laid out as
// a numbered outline, from the text extract.py writes. Pure: text in, topic
// tree out, so every objective is the board's own wording.
//
// It covers the layouts the AS & A Level parser (cambridge.mjs) does not:
//   Core | Supplement   two columns of numbered objectives (IGCSE sciences)
//   C1.1 / E1.1         tier-prefixed topic codes (IGCSE Mathematics)
//   1.3.1 sub-topics    with bullets or a sentence (Economics, Business)
//   1.3 objectives      the board numbers each objective itself (Additional Maths)
// and the right-hand column is read by the header above it: "Notes ..." is
// notes, "Supplement" is more objectives, no header means more of the same.
//
// A syllabus it cannot read as an outline returns no units; the caller lists
// it as not loaded rather than guessing.

const CONTENT_PAGE_RE = /syllabus for [^\n]*\.\s*Subject content|^\s*\d\s+Subject content\s*$/m;
const NOISE_RE = /^(Subject content$|Back to contents page|www\.cambridgeinternational\.org|Cambridge (International|IGCSE|O Level)[^\n]*syllabus for|© |continued$|\(continued\)$)/i;
const SCOPE_RE = /^(AS Level|AS|A Level) (?:subject )?content$/;
const CODE_RE = /^([A-Z]{1,2})?(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\.?\s+(\S.*)$/;
const UNIT_RE = /^([A-Z]{1,2})?(\d{1,2})\s+(\S.*)$/;
const ITEM_RE = /^(\d{1,2})\s+(\S.*)$/;
const BULLET_RE = /^[•▪●◦–-]\s+(\S.*)$/;
const LETTER_RE = /^\((?:[a-z]|i{1,3}|iv|v|vi{1,3}|ix|x)\)\s+\S/;
const NOTES_HEAD = /^(Notes|Notes and examples|Notes and guidance|Notes and Guidance|Notes\/Examples|Guidance|Teaching notes|Additional guidance)$/;
/** Header text strong enough to stand alone on a line ("examples" wrapped onto a line is not a header). */
const NOTES_HEAD_ALONE = /^(Notes and examples|Notes and guidance|Notes and Guidance|Notes\/Examples|Teaching notes|Additional guidance)$/;
const HEAD_LEFT = /^((Candidates|Learners) should (be able to|have an understanding of|know and understand|understand|know)[a-z ,]*:?|Core|Content|Topic|Subject content|Learning outcomes?)$/i;

/** Objectives open with a command word; unit titles never do. */
const COMMAND_RE = /^(?:Analyse|Apply|Appreciate|Assess|Calculate|Carry|Classify|Compare|Complete|Construct|Convert|Create|Deduce|Define|Demonstrate|Derive|Describe|Design|Determine|Develop|Discuss|Distinguish|Draw|Estimate|Evaluate|Expand|Factorise|Form|Obtain|Rearrange|Manipulate|Verify|Differentiate|Integrate|Substitute|Locate|Order|Round|Translate|Reflect|Rotate|Enlarge|Collect|Change|Add|Multiply|Divide|Sort|Test|Plan|Respond|Review|Explain|Express|Find|Give|Identify|Illustrate|Interpret|Investigate|Justify|Know|List|Make|Measure|Name|Outline|Perform|Plot|Predict|Produce|Prove|Read|Recall|Recognise|Recognize|Relate|Represent|Select|Show|Simplify|Sketch|Solve|State|Suggest|Understand|Use|Write)\b/;
const PLACEHOLDER_RE = /^(Extended|Core|Supplement)( subject)? content only\.?$/i;
const clean = (s) => s.replace(/\s+/g, " ").trim();
const words = (s) => s.trim().split(/\s+/).length;
const stripContinued = (s) => clean(s.replace(/\s*\(?continued\)?\s*$/i, ""));

/** Right-column start for a page: header position if present, else the common start of far-right text. */
function rightColumn(lines) {
  for (const l of lines) {
    const m = l.match(/^(\s*)(\S.*?)\s{3,}(Supplement|Learning outcomes|Notes and examples|Notes and guidance|Notes and Guidance|Notes\/Examples|Notes|Guidance)\s*$/);
    if (m) return { col: l.lastIndexOf(m[3]), head: /Supplement/.test(m[3]) ? "supplement" : /Learning outcomes/.test(m[3]) ? "outcomes" : "notes" };
  }
  const starts = new Map();
  for (const l of lines) {
    const re = /\S\s{3,}(?=\S)/g;
    let m;
    while ((m = re.exec(l))) {
      const at = m.index + m[0].length;
      if (at >= 45) starts.set(at, (starts.get(at) ?? 0) + 1);
    }
  }
  let best = null, n = 0;
  for (const [at] of starts) {
    let c = 0;
    for (const [b, k] of starts) if (Math.abs(b - at) <= 2) c += k;
    if (c > n || (c === n && at < best)) { best = at; n = c; }
  }
  return n >= 3 ? { col: best, head: null } : { col: null, head: null };
}

function split(line, col) {
  if (col === null || line.length <= col - 2) return [line, ""];
  // Nothing left of the column: the whole line is right-column text.
  if (!line.slice(0, Math.max(0, col - 2)).trim()) return ["", line];
  let best = null;
  const gap = /\s{2,}/g;
  let m;
  while ((m = gap.exec(line))) {
    const end = m.index + m[0].length;
    if (m.index === 0) continue;
    // Right-column text may start a few characters in (an item number's hanging indent).
    const ok = end - col >= -6 && end - col <= (m[0].length >= 3 ? 14 : 6);
    if (ok && (best === null || Math.abs(end - col) < Math.abs(best - col))) best = end;
  }
  if (best !== null) return [line.slice(0, best), line.slice(best)];
  // Text starting at or past the column with nothing to its left is right-column only.
  if (!line.slice(0, Math.max(0, col - 2)).trim()) return ["", line];
  return [line, ""];
}

export function parseCambridgeOutline(text) {
  const pages = text.split("\f");
  const units = new Map();
  let scope = null;
  let unit = null, topic = null, sub = null;
  let mode = "body"; // what the right-hand column holds: notes | supplement | body
  let cur = null; // objective being built (left column)
  let sup = null; // supplement objective being built (right column)
  let pendingNotes = [];
  let titleOpen = false;
  const skipped = []; // text outside the outline, kept for review
  let paused = false; // prose after a list: ignored until the next item or code

  const unitFor = (code, title, page) => {
    if (!units.has(code)) units.set(code, { code, title, scope, page, topics: new Map(), order: units.size });
    const u = units.get(code);
    if (title && u.title.startsWith("Unit ")) u.title = title;
    return u;
  };
  const topicFor = (u, code, title, page) => {
    if (!u.topics.has(code)) u.topics.set(code, { code, title, scope: scope ?? u.scope, page, items: [], subs: new Map(), lead: [] });
    return u.topics.get(code);
  };
  const newItem = (where, number, body, group, page) => {
    const it = { number, parts: body ? [body] : [], notes: pendingNotes.splice(0), group, page };
    where.items.push(it);
    return it;
  };

  // Look-ahead: the next topic code on the following lines, to tell "2  Motion" (a unit) from "2  Describe ..." (an item).
  const allLines = [];
  pages.forEach((p, i) => {
    if (!CONTENT_PAGE_RE.test(p)) return;
    for (const l of p.split("\n")) allLines.push({ page: i + 1, raw: l.replace(/\t/g, "    ") });
  });
  const nextCode = (from) => {
    for (let k = from + 1; k < Math.min(allLines.length, from + 40); k++) {
      const m = allLines[k].raw.trim().match(CODE_RE);
      if (m) return { prefix: m[1] ?? "", n: m[2] };
    }
    return null;
  };

  let pageNo = null, col = null, head = null, minIndent = 0;
  for (let idx = 0; idx < allLines.length; idx++) {
    const { page, raw } = allLines[idx];
    if (page !== pageNo) {
      pageNo = page;
      const pl = allLines.filter((x) => x.page === page).map((x) => x.raw);
      ({ col, head } = rightColumn(pl));
      minIndent = Math.min(...pl.filter((x) => x.trim() && !NOISE_RE.test(x.trim()) && !/syllabus for/.test(x)).map((x) => x.search(/\S/)).filter((n) => n >= 0), 99);
      if (head) mode = head;
      // A new page never continues a supplement item across the break without its number.
    }
    const trimmed = raw.trim();
    if (!trimmed || NOISE_RE.test(trimmed) || /^\d{1,3}$/.test(trimmed)) continue;
    let [lraw, rraw] = split(raw, col);
    // A bullet glyph left behind at the column edge belongs to the right column's text.
    const stray = lraw.match(/(^|\s{2,})([•▪●◦–-])\s*$/);
    if (stray && rraw.trim()) { lraw = lraw.slice(0, stray.index); rraw = `${stray[2]}   ${rraw.trimStart()}`; }
    // "continued" at the far edge of a page is a layout marker; a heading repeated with
    // "continued" on the next page ("4.2 ... (IDEs) continued") is layout too.
    lraw = lraw.replace(/\s{3,}\(?continued\)?\s*$/i, "");
    rraw = rraw.replace(/^\s*\(?continued\)?\s*$/i, "");
    {
      const lt = clean(lraw);
      const m = lt.match(/^(.*\S)\s+\(?continued\)?$/i);
      if (m && !CODE_RE.test(lt) && !UNIT_RE.test(lraw.trim())) {
        const known = [topic?.title, sub?.title, unit?.title].filter(Boolean).map((x) => x.toLowerCase());
        const head = m[1].toLowerCase().replace(/:$/, "");
        if (known.some((k) => k.endsWith(head) || k.includes(head)) || words(head) <= 6) lraw = "";
      }
    }
    const l = clean(lraw), r = clean(rraw);
    if (!l && !r) continue;

    const scopeM = l.match(SCOPE_RE);
    if (scopeM) { scope = scopeM[1].startsWith("AS") ? "AS" : "A"; cur = null; sup = null; continue; }

    // "Learning outcomes" over the right column: the objectives are on the right,
    // the left column carries only the topic code and title.
    if (/^Learning outcomes( continued)?$/i.test(r)) {
      mode = "outcomes";
      const cm = l.match(CODE_RE);
      if (!cm) { if (l && topic && !topic.items.length) topic.title = clean(`${topic.title} ${stripContinued(l)}`); cur = null; continue; }
    }
    if (mode === "outcomes" && /^(Candidates|Learners) should be able to:?$/i.test(r)) {
      if (l && topic && !topic.items.length && !CODE_RE.test(l)) topic.title = clean(`${topic.title} ${stripContinued(l)}`);
      cur = null; continue;
    }

    // Column headers set what the right column holds.
    if (HEAD_LEFT.test(l) || (!l && NOTES_HEAD_ALONE.test(r)) || (!l && /^Supplement$/.test(r))) {
      if (/^Supplement$/i.test(r)) mode = "supplement";
      else if (NOTES_HEAD.test(r)) mode = "notes";
      else if (/^Core$/i.test(l)) mode = r ? mode : "supplement";
      if (topic && !r && /^(Candidates|Learners) should/i.test(l)) mode = mode === "supplement" ? "body" : mode;
      // "6.1.2 The Solar System" followed by its own column header is a topic, not a sub-topic.
      if (sub && !sub.parts.length && topic && /^(Core|Candidates should be able to:?|Learners should be able to:?)$/i.test(l)) promote();
      paused = false;
      if (topic) {
        // Text between a topic heading and its first column header is a preface ("In 1.3 each atom ..."), not objectives.
        if (!topic.headed && topic.items.length && topic.items.every((i) => i.number === null)) topic.items = [];
        topic.headed = true;
      }
      cur = null; sup = null; titleOpen = false;
      continue;
    }

    const code = lraw.search(/\S/) <= minIndent + 3 ? l.match(CODE_RE) : null;
    if (code && !LETTER_RE.test(l)) {
      paused = false;
      const [, prefix = "", a, b, c, rest] = code;
      const title = stripContinued(rest);
      const uCode = `${prefix}${a}`;
      // "C1.1" sits under the unit headed "1  Number"; "C3.1" under "C3  Atoms ...".
      if (!unit || (unit.code !== uCode && unit.code !== a)) {
        unit = units.get(uCode) ?? units.get(a) ?? unitFor(uCode, `Unit ${uCode}`, page);
      }
      const tCode = `${prefix}${a}.${b}`;
      if (NOTES_HEAD.test(r)) mode = "notes";
      if (c === undefined) {
        const known = unit.topics.has(tCode);
        topic = topicFor(unit, tCode, title, page);
        topic.indent = lraw.search(/\S/);
        titleOpen = !known;
        sub = null; cur = null; sup = null;
        if (r && !NOTES_HEAD.test(r) && !/^Learning outcomes/i.test(r)) handleRight(r, page);
      } else {
        if (!topic || topic.code !== tCode) topic = topicFor(unit, tCode, `Topic ${tCode}`, page);
        const sCode = `${tCode}.${c}`;
        if (!topic.subs.has(sCode)) topic.subs.set(sCode, { code: sCode, title, parts: [], rparts: [], notes: pendingNotes.splice(0), page });
        sub = topic.subs.get(sCode);
        cur = null; sup = null;
        if (r) handleRight(r, page);
      }
      continue;
    }

    const um = lraw.trim().match(UNIT_RE);
    if (um && !LETTER_RE.test(l)) {
      const [, given = "", n, rest] = um;
      const title = stripContinued(rest);
      const nc = nextCode(idx);
      // "1  Number" heads the topics C1.1, C1.2 ... that follow it: the unit takes their prefix.
      const prefix = given || (nc && nc.n === n ? nc.prefix : "");
      const uCode = `${prefix}${n}`;
      const curPrefix = unit ? unit.code.replace(/\d+$/, "") : "";
      const curN = unit ? Number(unit.code.slice(curPrefix.length)) : 0;
      const continued = !!unit && unit.code === uCode && /continued/i.test(rest);
      const titleLike = words(title) <= 14 && !/[.:;,]$/.test(title) && /^[A-Z(]/.test(title)
        && !COMMAND_RE.test(title) && !/\s(by|of|the|and|to|in|a|an|with|for|as|or|on|from|at)$/.test(title);
      const ahead = !unit || prefix !== curPrefix || Number(n) > curN;
      // A unit with no numbered topics: its own header follows within a few lines.
      const headerNext = allLines.slice(idx + 1, idx + 6).some((x) => /^\s*(Candidates|Learners) should be able to/.test(x.raw)) && !(nc && nc.n === n);
      const isUnit = continued || (titleLike && ahead && ((!!nc && nc.n === n && nc.prefix === prefix) || headerNext));
      if (isUnit) {
        unit = unitFor(uCode, title, page);
        if (unit.title.startsWith("Unit ")) unit.title = title;
        if (/\(AS Level\)/.test(title)) unit.scope = "AS";
        if (/\(A Level\)/.test(title)) unit.scope = "A";
        topic = null; sub = null; cur = null; sup = null;
        if (headerNext && !continued) { topic = topicFor(unit, uCode, title, page); titleOpen = false; }
        continue;
      }
    }

    // A topic title that wraps onto the next line.
    if (titleOpen && topic && !topic.items.length && !topic.subs.size && l
        && !ITEM_RE.test(l) && !BULLET_RE.test(l) && lraw.search(/\S/) > topic.indent) {
      topic.title = clean(`${topic.title} ${stripContinued(l)}`);
      if (r) handleRight(r, page);
      continue;
    }
    if (l) titleOpen = false;

    if (!topic) { if (units.size) skipped.push({ page, text: clean(`${l} ${r}`) }); continue; } // prose outside the outline
    if (mode === "outcomes") {
      if (l && !topic.items.length) topic.title = clean(`${topic.title} ${stripContinued(l)}`);
      if (r) handleLeft(r, rraw, page);
      continue;
    }
    if (l) handleLeft(l, lraw, page);
    if (r && topic) handleRight(r, page);
  }

  /** A board item number continues the topic's numbering; "20 000 Hz" wrapped onto a new line does not. */
  function plausibleNumber(n) {
    if (n < 1 || n > 60) return false;
    const used = topic.items.filter((i) => i.number !== null).map((i) => i.number);
    if (used.includes(n)) return false;
    const max = used.length ? Math.max(...used) : 0;
    return n <= max + 4 || (!used.length && n <= 20);
  }

  /** A sub-topic whose content is numbered items is a topic of its own. */
  function promote() {
    topic.subs.delete(sub.code);
    topic = topicFor(unit, sub.code, sub.title, sub.page);
    topic.headed = true;
    sub = null;
  }

  function handleLeft(l, lraw, page) {
    if (sub && !sub.parts.length && !sub.rparts.length && ITEM_RE.test(l) && mode !== "body") promote();
    const atMargin = lraw.search(/\S/) <= minIndent + 1 && !ITEM_RE.test(l) && !BULLET_RE.test(l) && !LETTER_RE.test(l);
    // A short heading at the margin between numbered items ("Physical chemistry", "Pure Mathematics 1") closes the item.
    if (cur && cur.number !== null && atMargin && words(l) <= 5 && /^[A-Z]/.test(l) && !/[.:;,]$/.test(l)) { cur = null; return; }
    // Prose at the margin after a sub-topic or a numbered list ("Paper 2 – Human Geography ...") is
    // outside the outline: nothing is read until the next code.
    if (atMargin && !cur && /^[a-z]/.test(l) && topic.items.length) { cur = topic.items.at(-1); }
    if (atMargin && /^[A-Z]/.test(l) && ((sub && (sub.parts.length || sub.rparts.length)) || (!sub && topic.items.some((i) => i.number !== null) && (!cur || cur.number !== null || cur.group)))) {
      sub = null; cur = null; sup = null; paused = true;
      skipped.push({ page, text: l });
      return;
    }
    // While paused, only a new item resumes the list.
    if (paused) {
      if (ITEM_RE.test(l) && plausibleNumber(Number(l.match(ITEM_RE)[1]))) paused = false;
      else { skipped.push({ page, text: l }); return; }
    }
    if (sub) { sub.parts.push(l.replace(BULLET_RE, "• $1")); return; }
    const item = l.match(ITEM_RE);
    const bullet = l.match(BULLET_RE);
    const indent = lraw.search(/\S/);
    if (item && !LETTER_RE.test(l) && plausibleNumber(Number(item[1]))) {
      cur = newItem(topic, Number(item[1]), item[2], null, page);
      cur.indent = indent;
      return;
    }
    if (bullet) {
      // A bullet under a stem ("Identify and use:") or deeper than its item belongs to it.
      if (cur && (/:$/.test(cur.parts.at(-1) ?? "") || indent > cur.indent + 1 || cur.folding)) {
        cur.parts.push(`• ${bullet[1]}`); cur.folding = true; return;
      }
      cur = newItem(topic, null, bullet[1], null, page);
      cur.indent = indent;
      return;
    }
    if (LETTER_RE.test(l)) {
      // "(a) describe ..." under a numbered item or a stem belongs to it; a list of lettered items standing alone is a list of objectives.
      if (cur && !cur.lettered) { cur.parts.push(l); cur.folding = true; return; }
      cur = newItem(topic, null, l, null, page);
      cur.indent = indent; cur.lettered = true;
      return;
    }
    if (cur) { cur.parts.push(l); return; }
    // A line before any item: a stem that its bullets will join.
    cur = newItem(topic, null, l, null, page);
    cur.indent = indent;
  }

  function handleRight(r, page) {
    if (mode === "notes") {
      if (sub) sub.notes.push(r);
      else if (cur) cur.notes.push(r);
      else pendingNotes.push(r);
      return;
    }
    if (mode === "supplement") {
      if (!topic) return;
      if (sub && !sub.parts.length && !sub.rparts.length && ITEM_RE.test(r)) promote();
      const item = r.match(ITEM_RE);
      if (item && !LETTER_RE.test(r) && plausibleNumber(Number(item[1]))) { sup = newItem(topic, Number(item[1]), item[2], "Supplement", page); return; }
      if (sup) sup.parts.push(r.replace(BULLET_RE, "$1"));
      return;
    }
    // No header: the right column carries more of the same content.
    if (sub) { sub.rparts.push(r.replace(BULLET_RE, "• $1")); return; }
    if (topic) handleLeft(r, r, page);
  }

  // A unit whose heading could not be read (a rotated page) takes its title
  // from the syllabus's own content overview list.
  const untitled = [...units.values()].filter((u) => u.title.startsWith("Unit "));
  if (untitled.length) {
    const listed = new Map();
    for (const p of pages) {
      if (CONTENT_PAGE_RE.test(p)) continue;
      for (const line of p.split("\n")) {
        for (const seg of line.trim().split(/\s{3,}/)) {
          const m = seg.match(/^([A-Z]{0,2}\d{1,2})\s+([A-Z][^.:;]{2,90})$/);
          if (m && !/\.{3,}|\d+$/.test(m[2]) && !listed.has(m[1])) listed.set(m[1], clean(m[2]));
        }
      }
    }
    for (const u of untitled) if (listed.has(u.code)) u.title = listed.get(u.code);
  }

  // IGCSE tiers: "Supplement" objectives and the Extended list are for Extended
  // candidates; topics coded C1.1 / E1.1 belong to the Core / Extended lists.
  const igcse = /Cambridge IGCSE/.test(text);
  const tiered = igcse && /^\s*Core subject content\s*$/m.test(text) && /^\s*Extended subject content\s*$/m.test(text);
  const tierOf = (code) => (tiered && /^C\d/.test(code) ? "IGCSE_CORE" : tiered && /^E\d/.test(code) ? "IGCSE_EXTENDED" : null);

  // Build the tree: sub-topics are objectives; otherwise items are; a topic
  // with neither is itself an objective (the board numbered it directly).
  const out = [];
  for (const u of [...units.values()].sort((a, b) => a.order - b.order)) {
    const topics = [];
    const direct = [];
    for (const t of u.topics.values()) {
      let objs;
      if (t.subs.size) {
        objs = [...t.subs.values()].map((s) => {
          // Left column: the sub-topic's title and its wrapped lines; right column (no header): its content.
          const lead = s.parts.length && s.parts[0].startsWith("• ") && !/:$/.test(s.title) ? `${s.title}:` : s.title;
          const head = clean([lead, ...s.parts].join(" "));
          const body = [...s.rparts];
          const text = body.length ? `${head}${/:$/.test(head) ? "" : ":"} ${body.join(" ")}` : head;
          return { code: s.code, text: clean(text.replace(/: •/, ": •")), notes: clean(s.notes.join(" ")) || null, group: null, page: s.page };
        });
      } else if (t.items.length && !t.headed && (COMMAND_RE.test(t.title) || /^[a-z]/.test(t.title)) && t.items.every((i) => i.number === null)) {
        direct.push({ code: t.code, text: clean([t.title, ...t.items.map((i) => `• ${i.parts.join(" ")}`)].join(" ")), notes: clean(t.items.flatMap((i) => i.notes).join(" ")) || null, group: null, page: t.page });
        continue;
      } else if (t.items.length) {
        // A stem ("Know the exact values of:") completed by the lines after it.
        for (let k = 0; k < t.items.length - 1; k++) {
          const stem = t.items[k];
          const stemText = clean(stem.parts.join(" "));
          if (stem.number !== null || !/:$/.test(stemText)) continue;
          let j = k + 1;
          while (j < t.items.length && /^[a-z(]/.test(clean(t.items[j].parts.join(" "))) && t.items[j].group === stem.group) j++;
          if (j === k + 1) continue;
          const tail = t.items.slice(k + 1, j);
          if (tail.every((i) => i.number !== null)) {
            for (const i of tail) i.parts = [stemText, ...i.parts];
            t.items.splice(k, 1);
          } else {
            stem.parts.push(...tail.map((i) => `• ${clean(i.parts.join(" "))}`));
            stem.notes.push(...tail.flatMap((i) => i.notes));
            t.items.splice(k + 1, j - k - 1);
          }
        }
        // In a numbered list, an unnumbered fragment belongs to the item before it:
        // a label from the notes column ("Polygons: Solids:") to its notes, anything else to its text.
        if (t.items.filter((i) => i.number !== null).length >= Math.max(2, t.items.length - 2)) {
          for (let k = t.items.length - 1; k > 0; k--) {
            const it = t.items[k];
            if (it.number !== null) continue;
            const prev = t.items.slice(0, k).reverse().find((i) => i.group === it.group) ?? t.items[k - 1];
            const txt = clean(it.parts.join(" "));
            if (/^([A-Z][\w-]*:\s*){1,4}$/.test(txt)) prev.notes.push(txt, ...it.notes);
            else { prev.parts.push(...it.parts); prev.notes.push(...it.notes); }
            t.items.splice(k, 1);
          }
        }
        const numbered = t.items.every((i) => i.number !== null);
        const items = numbered ? [...t.items].sort((a, b) => a.number - b.number) : t.items;
        objs = items.map((i, k) => ({
          code: `${t.code}.${numbered ? i.number : k + 1}`,
          text: clean(i.parts.join(" ")), notes: clean(i.notes.join(" ")) || null, group: i.group, page: i.page,
          ...(igcse && i.group === "Supplement" ? { scope: "IGCSE_EXTENDED" } : {}),
        }));
      } else {
        // A bare heading ("1.5 Forces") whose content sits under deeper codes is not an objective.
        if (COMMAND_RE.test(t.title) || /^[a-z]/.test(t.title) || /\.$/.test(t.title)) direct.push({ code: t.code, text: t.title, notes: null, group: null, page: t.page });
        continue;
      }
      objs = objs.filter((o) => o.text);
      if (objs.length) topics.push({ code: t.code, title: t.title, scope: tierOf(t.code) ?? t.scope ?? u.scope ?? null, page: t.page, objectives: objs });
    }
    // "Extended content only." marks a gap in the Core list, not an objective.
    for (const t of topics) t.objectives = t.objectives.filter((o) => !PLACEHOLDER_RE.test(o.text));
    for (let k = topics.length - 1; k >= 0; k--) if (!topics[k].objectives.length || PLACEHOLDER_RE.test(topics[k].title)) topics.splice(k, 1);
    const directKept = direct.filter((o) => !PLACEHOLDER_RE.test(o.text));
    direct.length = 0; direct.push(...directKept);
    if (direct.length) topics.unshift({ code: u.code, title: u.title, scope: u.scope ?? null, page: direct[0].page, objectives: direct });
    if (topics.length) out.push({ code: u.code, title: u.title, scope: tierOf(u.code) ?? u.scope ?? null, topics });
  }
  return { style: "outline", units: out, skipped };
}

/**
 * Shape checks on top of the word-order audit: a parse that is technically
 * faithful but structurally implausible (one giant objective, a handful of
 * objectives for a whole subject) is not loaded.
 */
export function plausibility(parsed) {
  const problems = [];
  const objs = parsed.units.flatMap((u) => u.topics.flatMap((t) => t.objectives));
  const topics = parsed.units.reduce((n, u) => n + u.topics.length, 0);
  if (objs.length < 15) problems.push(`only ${objs.length} objectives`);
  if (topics < 3) problems.push(`only ${topics} topics`);
  const long = objs.filter((o) => o.text.length > 1500);
  if (long.length) problems.push(`${long.length} objectives over 1500 characters (first ${long[0].code})`);
  const codes = new Set();
  for (const o of objs) { if (codes.has(o.code)) problems.push(`duplicate objective code ${o.code}`); codes.add(o.code); }
  const LEAK = /Candidates should be able to|Learners should be able to|Notes and (examples|guidance)|Learning outcomes|Back to contents page|syllabus for \d{4}|\bcontinued\b/i;
  const leaks = objs.filter((o) => LEAK.test(o.text));
  if (leaks.length) problems.push(`${leaks.length} objectives carry layout text (first ${leaks[0].code}: "${leaks[0].text.slice(0, 60)}")`);
  const tleaks = parsed.units.flatMap((u) => u.topics).filter((t) => LEAK.test(t.title) || t.title.length > 160);
  if (tleaks.length) problems.push(`${tleaks.length} topic titles carry layout text (first ${tleaks[0].code}: "${tleaks[0].title.slice(0, 60)}")`);
  const wordless = objs.filter((o) => !/[A-Za-z]{3}/.test(o.text));
  if (wordless.length) problems.push(`${wordless.length} objectives without words (first ${wordless[0].code}: "${wordless[0].text}")`);
  // Lines that look like objectives but sit outside the outline mean the layout was misread.
  const lost = (parsed.skipped ?? []).filter((x) => /^[•▪●]\s/.test(x.text) || COMMAND_RE.test(x.text) || /^[a-z]+ /.test(x.text) && COMMAND_RE.test(x.text[0].toUpperCase() + x.text.slice(1)));
  if (lost.length > 12) problems.push(`${lost.length} objective-like lines fell outside the outline (first p${lost[0].page}: "${lost[0].text.slice(0, 50)}")`);
  const unitTitles = parsed.units.filter((u) => /^Unit /.test(u.title));
  if (unitTitles.length) problems.push(`${unitTitles.length} units without a title (${unitTitles.map((u) => u.code).join(", ")})`);
  return problems;
}
