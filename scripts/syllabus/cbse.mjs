// Parser for CBSE curriculum PDFs (cbseacademic.nic.in, "Curriculum 2026-27"),
// from the text extract.py writes. Pure: text in, topic tree out, so every
// objective is the board's own wording.
//
// One CBSE file usually covers two classes (XI and XII, or IX and X). Each
// class has a course-structure table, then the detailed syllabus:
//
//   Unit I: Physical World and Measurement        Unit-I: Sets and Functions
//   Chapter–1: Units and Measurements             1.      Sets
//   Need for measurement: Units of measurement;   Sets and their representations, …
//   …                                             …
//
// then practicals, project work, question paper design and books. A unit
// becomes a unit, a chapter a topic (a unit with no chapters is its own one
// topic), and each paragraph of the board's prose an objective.
//
// `parseCbseSyllabus(text, { classLabel: "XI" })` reads only that class's part.
// A file it cannot read cleanly returns no units; the caller lists it as not
// loaded rather than guessing.

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15 };
const CLASSES = ["IX", "X", "XI", "XII"];

/** "CLASS XI", "Class – XII (2026-27)", "CLASS X (2026-27)"; not "Classes XI-XII". */
const CLASS_HEAD = /^\s*CLASS\s*[–—-]?\s*(XII|XI|IX|X)\b(?!\s*[–—-]\s*X)/i;
/** A unit heading anywhere on the line (two columns are sometimes merged into one line). */
const UNIT_RE = /(?:^|\s{2,})UNIT[\s–—-]*([IVX]+|\d{1,2})\s*(?::|[–—-]\s+|\s{2,}|\s(?=[A-Z]))\s*([A-Z][^\n]*?)\s*$/i;
const CHAPTER_RE = /^\s*Chapter\s*[–—-]?\s*(\d{1,2})\s*:\s*(\S.*?)\s*$/i;
/** "1.      Sets" or "2. Relations & Functions": a short numbered heading on its own line. */
const NUMBERED_RE = /^\s*(\d{1,2})\.\s+([A-Z][A-Za-z,&'’()\- ]{2,70}?)\s*$/;
/** Where a class's detailed syllabus ends. */
const END_RE = /^\s*(PRACTICALS?\b|PRACTICAL SYLLABUS|Practical Work|Lab Practical|Project Work|PROJECT WORK|Guidelines for Project|QUESTION PAPER DESIGN|Question Paper Design|Prescribed Books|PRESCRIBED BOOKS|Suggested Readings?|INTERNAL ASSESSMENT|Internal Assessment|Evaluation Scheme|EVALUATION SCHEME|Assessment of Practical|List of Experiments|LIST OF EXPERIMENTS|Periodic Tests|Subject Enrichment)/;
/** Running heads, page numbers, course-structure rows: never objective text. */
const NOISE_RE = /^\s*(\d{1,3}|Page \d+.*|Total\b.*|Marks\b.*|Max\.? Marks.*|Time:.*|Three Hours.*|\(?Theory\)?|Unit\s+Name.*|S\.\s*No.*|No\.\s+Units.*|Units?\s+Marks.*|\*No chapter.*)\s*$/i;

/** The board marks some topics as assessed only formatively; they are not exam syllabus. */
const FORMATIVE_RE = /^\s*The following topics are included in the syllabus but will be assessed only formatively/i;
const LABEL_RE = /^\s*(Theme|Part\s+[A-D])\s*[:\-–]/i;
const GUIDANCE_RE = /^\s*(For all the numerical problems|This reduces academic stress|Schools can integrate|Relevant NCERT)/i;

const clean = (s) => s.replace(/\s+/g, " ").trim();

function unitNumber(raw) {
  const r = raw.toUpperCase();
  return ROMAN[r] ?? (Number.isFinite(Number(r)) ? Number(r) : null);
}

/** The line ranges of each class's part of the file, in reading order. */
function classSections(lines) {
  const heads = [];
  lines.forEach((l, i) => {
    const m = l.match(CLASS_HEAD);
    if (m) heads.push({ at: i, cls: m[1].toUpperCase() });
  });
  // A file for one class only ("Class – X (2026-27)") may never repeat its head.
  const sections = [];
  for (let k = 0; k < heads.length; k++) {
    const end = heads.slice(k + 1).find((h) => h.cls !== heads[k].cls)?.at ?? lines.length;
    if (sections.length && sections[sections.length - 1].cls === heads[k].cls) continue;
    sections.push({ cls: heads[k].cls, from: heads[k].at, to: end });
  }
  return sections;
}

/**
 * Splits prose into paragraphs: a paragraph ends on a line that ends a
 * sentence and the next line starts a new one, or on a bullet.
 */
function paragraphs(bodyLines) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) out.push(clean(cur.join(" "))); cur = []; };
  for (const raw of bodyLines) {
    const line = clean(raw.replace(/^\s*[•▪●◦❖⮚¾\uE000-\uF8FF]\s*/, "• ").replace(/[\uE000-\uF8FF]/g, ""));
    if (!line) continue;
    if (/^•\s/.test(line)) { flush(); cur.push(line.slice(2)); continue; }
    cur.push(line);
    if (/\.$/.test(line) && !/\b(e\.g|i\.e|viz|etc|Fig|No|vs)\.$/i.test(line)) flush();
  }
  flush();
  // One very long paragraph is split at sentence ends so each objective stays readable.
  return out.flatMap((p) => p.length <= 700 ? [p] : p.split(/(?<=[a-z)\]]\.)\s+(?=[A-Z])/)).filter((p) => /[A-Za-z]{3}/.test(p));
}

/** Parses one line range as a class's detailed syllabus. */
function parseRange(lines, raw, range) {
  const units = [];
  let bodyLines = 0, gapped = 0;
  let unit = null, topic = null, body = [], started = false;
  const flushBody = () => {
    if (!unit || !body.length) { body = []; return; }
    if (!topic) {
      topic = { code: `${unit.code}.1`, title: unit.title, page: body[0]?.page ?? unit.page, objectives: [], implicit: true };
      unit.topics.push(topic);
    }
    for (const p of paragraphs(body.map((b) => b.text))) {
      topic.objectives.push({ code: `${topic.code}.${topic.objectives.length + 1}`, text: p, notes: null, group: null, page: body[0]?.page ?? topic.page });
    }
    body = [];
  };
  for (let i = range.from; i < range.to; i++) {
    const { text: line, page } = lines[i];
    const um = line.match(UNIT_RE);
    if (um) {
      // The detailed syllabus starts at the first unit heading followed by prose,
      // not by the next row of the course-structure table.
      const next = raw.slice(i + 1, i + 6).map(clean).filter(Boolean);
      const isTableRow = next.length && next.every((n) => UNIT_RE.test(" " + n) || NOISE_RE.test(n) || /^[IVX]+\.?\s/.test(n) || n.length < 4);
      const n = unitNumber(um[1]);
      // Detailed headings carry a colon ("Unit I:", "Unit-I:", "UNIT I:");
      // course-structure rows do not ("Unit–I   Physical World …").
      const colon = /UNIT[\s–—-]*(?:[IVX]+|\d{1,2})\s*:/i.test(line);
      // Some subjects (Biology) write detailed headings without the colon; those
      // start the detailed part only when real prose follows within a few lines.
      const prose = next.some((x) => x.length > 60 && !UNIT_RE.test(" " + x) && !CHAPTER_RE.test(x) && !NOISE_RE.test(x));
      if (!started && !((colon && !isTableRow) || prose)) continue;
      if (n === null) continue;
      const code = `${range.cls}.${n}`;
      flushBody();
      // A unit seen again: if the first sighting carried no prose it was a row
      // of the course-structure table and the real heading replaces it; if it
      // carried syllabus, this is an appendix restating the units and the
      // detailed part is over.
      const seen = units.findIndex((u) => u.code === code);
      if (seen >= 0) {
        if (units[seen].topics.some((t) => t.objectives.length)) break;
        units.splice(seen, 1);
      }
      started = true;
      topic = null;
      unit = { code, title: clean(um[2]).replace(/[:.]$/, ""), scope: null, topics: [], page };
      units.push(unit);
      continue;
    }
    if (!started) continue;
    if (END_RE.test(line)) break;
    const cm = line.match(CHAPTER_RE) || (NUMBERED_RE.test(line) && clean(line).length < 75 ? line.match(NUMBERED_RE) : null);
    if (cm && unit) {
      flushBody();
      topic = { code: `${unit.code}.${unit.topics.length + 1}`, title: clean(cm[2]), page, objectives: [] };
      unit.topics.push(topic);
      continue;
    }
    // A note under a unit (topics assessed only formatively, and the like) is
    // guidance about the syllabus, not syllabus; skip to the next unit.
    // A note ("Note: …", "The following topics are … assessed only formatively …")
    // is guidance about the syllabus, not syllabus: skip its sentence. What it
    // introduces stays where the board put it.
    if (/^\s*Note\s*[:\-–]/i.test(line) || FORMATIVE_RE.test(line)) {
      flushBody();
      // The note runs until the next line that starts syllabus again: a unit or
      // chapter heading, a numbered item, or a "Topic: …" lead-in.
      while (i + 1 < range.to) {
        const nextLine = lines[i + 1].text;
        if (clean(nextLine) && (UNIT_RE.test(nextLine) || CHAPTER_RE.test(nextLine) || END_RE.test(nextLine) || /^\s*\d{1,2}\.\s/.test(nextLine) || /^\s*[A-Z][A-Za-z ,'’&-]{3,60}:\s/.test(nextLine))) break;
        i++;
      }
      continue;
    }
    // Section labels between units ("Part B: Introductory Microeconomics",
    // "Theme: How Things Work") and teaching guidance are not objectives.
    if (LABEL_RE.test(line) || GUIDANCE_RE.test(line)) { flushBody(); continue; }
    if (!unit) continue;
    if (NOISE_RE.test(line) || !clean(line)) continue;
    bodyLines += 1;
    // Text continuing after a wide gap mid-line is a second column.
    // (Justified prose and a bullet's indent leave gaps of a few spaces; a
    // second column leaves eight or more.)
    if (/\S\s{8,}\S/.test(line.trim().replace(/^[•▪●◦❖⮚\uE000-\uF8FF]\s*/, "")) && line.trim().length > 40) gapped += 1;
    body.push({ text: line, page });
  }
  flushBody();
  for (const u of units) u.topics = u.topics.filter((t) => t.objectives.length);
  return { units: units.filter((u) => u.topics.length), bodyLines, gapped };
}

export function parseCbseSyllabus(text, { classLabel } = {}) {
  const lines = [];
  text.split("\f").forEach((p, pi) => p.split("\n").forEach((l) => lines.push({ text: l, page: pi + 1 })));
  const raw = lines.map((l) => l.text);
  const sections = classSections(raw);
  const cls = classLabel ?? sections[0]?.cls;
  if (!cls) return { style: "cbse", units: [], skipped: [], classes: [], bodyLines: 0, gapped: 0 };
  // Candidate ranges for the class: each part under its own head, and, because
  // the first class of a two-class file often has no head of its own (the file
  // opens with it), the stretch from the start up to the next class's head.
  const order = CLASSES.indexOf(cls);
  const candidates = sections.filter((s) => s.cls === cls);
  const firstOther = sections.find((s) => s.cls !== cls && CLASSES.indexOf(s.cls) > order);
  if (!sections.some((s) => CLASSES.indexOf(s.cls) < order && s.from < (candidates[0]?.from ?? Infinity))) {
    candidates.push({ cls, from: 0, to: firstOther ? firstOther.from : raw.length });
  }
  // The detailed syllabus is the candidate that reads as the most syllabus.
  let best = { units: [], bodyLines: 0, gapped: 0 };
  const size = (r) => r.units.reduce((n, u) => n + u.topics.reduce((k, t) => k + t.objectives.length, 0), 0);
  for (const range of candidates) {
    const r = parseRange(lines, raw, range);
    if (size(r) > size(best)) best = r;
  }
  return { style: "cbse", ...best, skipped: [], classes: sections.map((s) => s.cls) };
}

/** Checks the CBSE tree must pass before it loads, on top of the shared word-order audit. */
export function cbsePlausibility(parsed) {
  const problems = [];
  const objs = parsed.units.flatMap((u) => u.topics.flatMap((t) => t.objectives));
  if (parsed.units.length < 2) problems.push(`only ${parsed.units.length} units`);
  if (objs.length < 8) problems.push(`only ${objs.length} objectives`);
  // A two-column table (topic | learning outcome) read line by line interleaves
  // the columns into sentences the board never wrote; the word-order audit
  // cannot see that, so the layout itself is refused.
  if (parsed.bodyLines && parsed.gapped / parsed.bodyLines > 0.12) {
    problems.push(`${parsed.gapped} of ${parsed.bodyLines} lines run into a second column; this layout is a table, not prose`);
  }
  const codes = new Set();
  for (const u of parsed.units) {
    if (codes.has(u.code)) problems.push(`duplicate unit ${u.code}`);
    codes.add(u.code);
    if (u.title.length > 120 || !/[A-Za-z]{3}/.test(u.title)) problems.push(`unit ${u.code} title looks wrong: "${u.title.slice(0, 60)}"`);
  }
  // A table read as prose leaves unit titles that are chapter labels and a
  // scatter of one- or two-word "objectives".
  const chapterUnits = parsed.units.filter((u) => /^(The\s+)?Chapter\b/i.test(u.title));
  if (chapterUnits.length) problems.push(`${chapterUnits.length} unit titles are chapter labels (first ${chapterUnits[0].code}: "${chapterUnits[0].title.slice(0, 50)}")`);
  const fragments = objs.filter((o) => o.text.length < 25);
  if (objs.length && fragments.length / objs.length > 0.2) problems.push(`${fragments.length} of ${objs.length} objectives are fragments under 25 characters (first ${fragments[0].code}: "${fragments[0].text}")`);
  const LEAK = /\b(Max\.? Marks|Marks\s*\d|Periods|Weightage|Question Paper|Internal Assessment)\b/;
  const leaks = objs.filter((o) => LEAK.test(o.text) && o.text.length < 120);
  if (leaks.length) problems.push(`${leaks.length} objectives carry table or assessment text (first ${leaks[0].code}: "${leaks[0].text.slice(0, 60)}")`);
  return problems;
}

/**
 * The shared glyph check refuses '#', '"' and '~' because a broken maths
 * extraction leaves them as stand-ins. CBSE computing syllabi use '#' and '"'
 * literally ("display each word separated by a #", "hello world"), so those two
 * are allowed when they are in the source text exactly as read; every other
 * part of the audit applies unchanged.
 */
export function cbseAuditProblems(problems) {
  return problems.filter((p) => !/has an unmapped glyph/.test(p) || /[\u0000-\u0008\u000b-\u001f\uE000-\uF8FF~]|\(cid:/.test(p.slice(p.indexOf('"'))));
}
