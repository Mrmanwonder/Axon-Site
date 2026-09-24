import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

export const SOURCES = {
  cambridge_igcse: {
    provider: "cambridge",
    url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/",
    version: "2026-live",
    parser: "cambridge-html-v1"
  },
  cambridge_advanced: {
    provider: "cambridge",
    url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/",
    version: "2026-live",
    parser: "cambridge-html-v1"
  },
  cbse_curriculum: {
    provider: "cbse",
    url: "https://cbseacademic.nic.in/curriculum_2027.html",
    version: "2026-27",
    parser: "cbse-html-v1"
  },
  cbse_skill: {
    provider: "cbse",
    url: "https://cbseacademic.nic.in/skill-education-curriculum.html",
    version: "2026-27",
    parser: "cbse-html-v1"
  },
  ibdp_subjects: {
    provider: "ib",
    url: "https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf",
    version: "2026",
    parser: "ib-pdf-v1"
  }
};

const ENTITIES = new Map([
  ["amp", "&"], ["nbsp", " "], ["ndash", "–"], ["mdash", "—"],
  ["rsquo", "’"], ["lsquo", "‘"], ["quot", "\""], ["#39", "'"]
]);

function decodeHtml(value) {
  return value
    .replace(/&([a-zA-Z]+|#39);/g, function (_, key) { return ENTITIES.get(key) || "&" + key + ";"; })
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textOf(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function loose(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sortedUnique(rows, keyFn) {
  const out = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key && !out.has(key)) out.set(key, row);
  }
  return [...out.values()].sort(function (a, b) { return keyFn(a).localeCompare(keyFn(b)); });
}

async function fetchBytes(source) {
  const headers = {
    "user-agent": "Axon curriculum catalog reconciler/1.0 (+https://axonstudy.online/)",
    "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-GB,en;q=0.9"
  };
  const response = await fetch(source.url, {
    redirect: "follow",
    headers: headers,
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(source.url + " returned " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes: bytes, sha256: sha256(bytes), fetched_at: new Date().toISOString() };
}

function mainContent(html) {
  const match = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  return match ? match[1] : html;
}

function extractAnchors(html) {
  const rows = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const hrefMatch = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(match[1]);
    const text = textOf(match[2]);
    if (text) rows.push({ href: hrefMatch ? hrefMatch[2] : null, text: text });
  }
  return rows;
}

function extractFourDigitCode(text) {
  const matches = [...String(text).matchAll(/(?:^|[^\d])(\d{4})(?!\d)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

function cleanCambridgeName(text, code) {
  let name = text
    .replace(/\bNew\b/gi, " ")
    .replace(/\(\s*AS Level only\s*\)|\(\s*AS only\s*\)|\(\s*A Level only\s*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (code) {
    const suffix = new RegExp("\\s*[-–—]?\\s*\\(?" + code + "\\)?(?:\\s*[-–—].*)?$");
    name = name.replace(suffix, "").replace(/\s+/g, " ").trim();
  }
  return name
    .replace(/\s*[–—]\s*/g, " - ")
    .replace(/\s+-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cambridgeBase(anchor, source) {
  if (!anchor.href) return null;
  const target = new URL(anchor.href, source.url);
  if (target.hostname.replace(/^www\./, "") !== "cambridgeinternational.org") return null;
  if (!target.pathname.toLowerCase().startsWith("/programmes-and-qualifications/")) return null;
  const code = extractFourDigitCode(anchor.text);
  if (!code) return null;
  // Subject-list labels end in the syllabus code (optionally followed by New).
  // Detail-page slugs are inconsistent: some include the code and some do not.
  // Using the bounded list label keeps 0991/0475 while rejecting syllabus-year,
  // news and support links elsewhere in main content.
  const label = anchor.text.trim();
  const codeIndex = label.indexOf(code);
  if (codeIndex < 3) return null;
  const suffix = label.slice(codeIndex + code.length).trim();
  // Current Cambridge list formats include:
  //   "... - 8689 (AS Level only)"
  //   "... - 9689 (A Level only)"
  //   "... (9866) – for centres in Pakistan"
  //   "... (9-1) 0989"
  //   "... - 0265 New"
  // Reject generic year links by requiring a subject-like prefix and allowing
  // only known list qualifiers after the code.
  if (suffix && !/^(?:\)?\s*(?:\((?:AS Level only|A Level only)\)|New|[-–—].*)?)$/i.test(suffix)) return null;
  const name = cleanCambridgeName(anchor.text, code);
  if (!name || /past papers|syllabus overview|published resources/i.test(name)) return null;
  return {
    canonical_name: name,
    display_name: name,
    external_code: code,
    external_code_kind: "syllabus_code",
    availability: "active",
    levels_supported: [],
    // The official display name already carries "(9-1)" where applicable.
    // Keep the source-derived row compatible with the current runtime catalog;
    // a dedicated normalization migration can populate variant separately.
    variant: null,
    aliases: [],
    source_url: target.href,
    source_version: source.version,
    metadata: { new: /\bNew\b/i.test(anchor.text) }
  };
}

export function parseCambridgeIgcse(html, source) {
  source = source || SOURCES.cambridge_igcse;
  const byCode = new Map();
  for (const anchor of extractAnchors(mainContent(html))) {
    const row = cambridgeBase(anchor, source);
    if (row) byCode.set(row.external_code, row);
  }
  const out = [];
  for (const row of byCode.values()) {
    out.push(Object.assign({}, row, { programme_key: "cambridge_igcse", stage_key: "cambridge_igcse_y10" }));
    out.push(Object.assign({}, row, { programme_key: "cambridge_igcse", stage_key: "cambridge_igcse_y11" }));
  }
  return out;
}

export function parseCambridgeAdvanced(html, source) {
  source = source || SOURCES.cambridge_advanced;
  const byCode = new Map();
  for (const anchor of extractAnchors(mainContent(html))) {
    const row = cambridgeBase(anchor, source);
    if (!row) continue;
    row.metadata.only_as = /\(\s*AS(?: Level)? only\s*\)/i.test(anchor.text);
    row.metadata.only_a = /\(\s*A Level only\s*\)/i.test(anchor.text);
    if (row.external_code === "9866") {
      // The 9866 listing card omits the level qualifier, while the first-party
      // subject page identifies it as Cambridge International A Level.
      row.metadata.only_a = true;
      row.metadata.only_as = false;
    }
    byCode.set(row.external_code, row);
  }
  const out = [];
  for (const row of byCode.values()) {
    if (!row.metadata.only_a) out.push(Object.assign({}, row, { programme_key: "cambridge_as", stage_key: "cambridge_as" }));
    if (!row.metadata.only_as) out.push(Object.assign({}, row, { programme_key: "cambridge_a_level", stage_key: "cambridge_a_level" }));
  }
  return out;
}

function domText(node) {
  return String(node?.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function cbseDom(html) {
  return new JSDOM(html).window.document;
}

function cbseHeadingElements(document) {
  return [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
}

function findDomHeading(headings, pattern, fromIndex) {
  for (let i = Math.max(0, fromIndex || 0); i < headings.length; i++) {
    if (pattern.test(domText(headings[i]))) return { element: headings[i], index: i };
  }
  return null;
}

function domNodesBetween(document, startElement, endElement) {
  if (!startElement) return [];
  const all = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,li")];
  const start = all.indexOf(startElement);
  const end = endElement ? all.indexOf(endElement) : all.length;
  if (start < 0) return [];
  return all.slice(start + 1, end >= 0 ? end : all.length);
}

function cbseCategory(text, current) {
  if (/^Languages\b/i.test(text)) return "language";
  if (/^Main Subjects\b/i.test(text)) return "main";
  if (/^(?:Other )?Academic Electives\b/i.test(text)) return "academic_elective";
  if (/^Optional Subjects\b/i.test(text)) return "optional";
  if (/^(?:Subjects of )?Internal Assessment\b/i.test(text)) return "internal_assessment";
  if (/^Skill Subjects\b/i.test(text)) return "skill";
  return current;
}

function cbseRow(name, stage, category, source, code) {
  const display = name
    .replace(/^\d{3}\s*-\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    programme_key: stage === "cbse_9" || stage === "cbse_10" ? "cbse_secondary" : "cbse_senior_secondary",
    stage_key: stage,
    canonical_name: display,
    display_name: display,
    external_code: code || null,
    external_code_kind: code ? "cbse_subject_code" : null,
    availability: "active",
    levels_supported: [],
    variant: null,
    aliases: [],
    source_url: source.url,
    source_version: source.version,
    metadata: { category: category || "other" }
  };
}

function parseCbseCurriculumNodes(nodes, stages, source) {
  let category = null;
  const rows = [];
  for (const node of nodes) {
    const text = domText(node);
    if (!text) continue;
    if (/^H[1-6]$/i.test(node.tagName)) {
      category = cbseCategory(text, category);
      continue;
    }
    if (node.tagName !== "LI" || !category || category === "skill") continue;

    const clone = node.cloneNode(true);
    for (const nested of clone.querySelectorAll("a")) {
      if (/Reading Material|Course\s+[AB]$/i.test(domText(nested))) nested.remove();
    }
    let name = domText(clone)
      .replace(/\s+Reading Material(?:\s.*)?$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name || /^(?:Initial Pages|Introduction|Reading Material)$/i.test(name)) continue;

    const names = /^Urdu$/i.test(name) ? ["Urdu"] : [name];
    for (const stage of stages) {
      for (const subjectName of names) rows.push(cbseRow(subjectName, stage, category, source, null));
    }
  }
  return rows;
}

export function parseCbseCurriculum(html, source) {
  source = source || SOURCES.cbse_curriculum;
  const document = cbseDom(html);
  const headings = cbseHeadingElements(document);
  const current = findDomHeading(headings, /Curriculum\s+for\s+the\s+Academic\s+Year\s+2026\s*-\s*27/i, 0);
  const from = current ? current.index + 1 : 0;
  const h9 = findDomHeading(headings, /Secondary\s+Curriculum.*\(Class\s+IX\)/i, from);
  const h10 = findDomHeading(headings, /Secondary\s+Curriculum.*\(Class\s+X\)/i, h9 ? h9.index + 1 : from);
  const hSenior = findDomHeading(headings, /Secondary\s+Curriculum.*\(XI\s*[-–]\s*XII\)/i, h10 ? h10.index + 1 : from);

  const rows = [
    ...parseCbseCurriculumNodes(domNodesBetween(document, h9?.element, h10?.element), ["cbse_9"], source),
    ...parseCbseCurriculumNodes(domNodesBetween(document, h10?.element, hSenior?.element), ["cbse_10"], source),
    ...parseCbseCurriculumNodes(domNodesBetween(document, hSenior?.element, null), ["cbse_11", "cbse_12"], source)
  ];
  return sortedUnique(rows, function (row) {
    return row.stage_key + "|" + loose(row.display_name);
  });
}

function stagesFromCbseSkillRow(node, fallbackStages) {
  const stages = new Set();
  for (const anchor of node.querySelectorAll("a")) {
    const label = domText(anchor).toUpperCase();
    if (label === "IX") stages.add("cbse_9");
    if (label === "X") stages.add("cbse_10");
    if (label === "XI") stages.add("cbse_11");
    if (label === "XII") stages.add("cbse_12");
  }
  return stages.size ? [...stages] : fallbackStages;
}

function parseCbseSkillNodes(nodes, fallbackStages, source) {
  let category = "skill";
  const rows = [];
  for (const node of nodes) {
    const text = domText(node);
    if (!text) continue;
    if (/^H[1-6]$/i.test(node.tagName)) {
      if (/Mandatory Skill Subject/i.test(text)) category = "mandatory_skill";
      if (/Optional Skill Subjects/i.test(text)) category = "skill";
      continue;
    }
    if (node.tagName !== "LI" || /Employability Skills/i.test(text)) continue;

    const parenthesized = /\((\d{3})\)/.exec(text);
    const prefixed = /^(\d{3})\s*-/.exec(text);
    const code = parenthesized ? parenthesized[1] : prefixed ? prefixed[1] : null;
    if (!code) continue;

    let name = parenthesized ? text.slice(0, parenthesized.index) : text;
    name = name
      .replace(/^\d{3}\s*-\s*/, "")
      .replace(/\s+(?:IX|X|XI|XII)(?:\s*[|&]\s*(?:XI|XII))?(?:\s.*)?$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) continue;

    for (const stage of stagesFromCbseSkillRow(node, fallbackStages)) {
      rows.push(cbseRow(name, stage, category, source, code));
    }
  }
  return rows;
}

export function parseCbseSkill(html, source) {
  source = source || SOURCES.cbse_skill;
  const document = cbseDom(html);
  const headings = cbseHeadingElements(document);
  const session = findDomHeading(headings, /Session\s+2026\s*-\s*2027/i, 0);
  const from = session ? session.index + 1 : 0;
  const h9 = findDomHeading(headings, /^Class\s+IX$/i, from);
  const h10 = findDomHeading(headings, /^Class\s+X$/i, h9 ? h9.index + 1 : from);
  const hSenior = findDomHeading(headings, /^Classes\s+XI\s*[-–]\s*XII$/i, h10 ? h10.index + 1 : from);
  const hModules = findDomHeading(headings, /Skill\s*Modules\s*\(Optional\)/i, hSenior ? hSenior.index + 1 : from);

  const rows = [
    ...parseCbseSkillNodes(domNodesBetween(document, h9?.element, h10?.element), ["cbse_9"], source),
    ...parseCbseSkillNodes(domNodesBetween(document, h10?.element, hSenior?.element), ["cbse_10"], source),
    ...parseCbseSkillNodes(domNodesBetween(document, hSenior?.element, hModules?.element), ["cbse_11", "cbse_12"], source)
  ];
  return sortedUnique(rows, function (row) {
    return row.stage_key + "|" + (row.external_code || loose(row.display_name));
  });
}

function pdfText(bytes) {
  const dir = mkdtempSync(join(tmpdir(), "axon-ib-"));
  const pdf = join(dir, "source.pdf");
  const txt = join(dir, "source.txt");
  try {
    writeFileSync(pdf, bytes);
    execFileSync("pdftotext", ["-layout", "-nopgbrk", pdf, txt], { stdio: "pipe" });
    return readFileSync(txt, "utf8");
  } catch (error) {
    throw new Error("IB importer requires pdftotext from poppler-utils: " + String(error));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function ibGroupKey(group) {
  const value = loose(group);
  if (value.includes("studies in language and literature")) return "studies_in_language_and_literature";
  if (value.includes("language acquisition")) return "language_acquisition";
  if (value.includes("individuals and societies")) return "individuals_and_societies";
  if (value.includes("sciences")) return "sciences";
  if (value.includes("mathematics")) return "mathematics";
  if (value.includes("arts")) return "arts";
  return "interdisciplinary_special";
}

export function parseIbText(text, source) {
  source = source || SOURCES.ibdp_subjects;
  const lines = text.split(/\r?\n/);
  const sectionNames = new Set([
    "STUDIES IN LANGUAGE AND LITERATURE", "LANGUAGE ACQUISITION",
    "INDIVIDUALS AND SOCIETIES", "SCIENCES", "MATHEMATICS", "ARTS",
    "INTERDISCIPLINARY ETC."
  ]);
  let header = null;
  let section = null;
  let discontinued = false;
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (/^DISCONTINUED SUBJECTS/.test(trimmed)) { discontinued = true; continue; }
    if (sectionNames.has(trimmed)) { section = trimmed; continue; }
    if (/SUBJECT CODE/.test(raw) && /NAME ON TRANSCRIPT/.test(raw)) {
      const fullStart = raw.indexOf("SUBJECT NAME FULL");
      header = {
        transcript: raw.indexOf("NAME ON TRANSCRIPT"),
        full: fullStart,
        sl: raw.indexOf("SL", fullStart + 1),
        hl: raw.indexOf("HL", fullStart + 1),
        group: raw.indexOf("SUBJECT GROUP")
      };
      continue;
    }
    if (discontinued || !header) continue;

    const codeMatch = /^\s*(\d{6})\s+/.exec(raw);
    if (!codeMatch) continue;
    const block = [raw];

    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      const nextTrim = next.trim();
      if (/^\s*\d{6}\s+/.test(next) || sectionNames.has(nextTrim) || /^DISCONTINUED SUBJECTS/.test(nextTrim)) break;
      i++;
      if (/© International Baccalaureate|SUBJECT CODE|Page \d+\s*\/\s*\d+/.test(next)) continue;
      block.push(next);
    }

    const transcript = block
      .map(function (line) { return line.slice(header.transcript, header.full).trim(); })
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const fullName = block
      .map(function (line) { return line.slice(header.full, header.sl).trim(); })
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const sl = block.some(function (line) { return /^Yes\b/i.test(line.slice(header.sl, header.hl).trim()); });
    const hlEnd = header.group > header.hl ? header.group : header.hl + 12;
    const hl = block.some(function (line) { return /^Yes\b/i.test(line.slice(header.hl, hlEnd).trim()); });
    const groupText = block
      .map(function (line) { return header.group >= 0 ? line.slice(header.group).trim() : ""; })
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const display = fullName || transcript;
    if (!display) continue;

    const base = {
      canonical_name: display,
      display_name: display,
      external_code: codeMatch[1],
      external_code_kind: "ib_subject_code",
      availability: "active",
      levels_supported: [sl ? "SL" : null, hl ? "HL" : null].filter(Boolean),
      variant: null,
      aliases: transcript && loose(transcript) !== loose(display) ? [transcript] : [],
      source_url: source.url,
      source_version: source.version,
      metadata: {
        group: groupText || section || null,
        group_key: ibGroupKey(groupText || section || ""),
        transcript_name: transcript || display
      }
    };
    rows.push(Object.assign({}, base, { programme_key: "ibdp", stage_key: "ibdp_1" }));
    rows.push(Object.assign({}, base, { programme_key: "ibdp", stage_key: "ibdp_2" }));
  }

  return sortedUnique(rows, function (row) { return row.stage_key + "|" + row.external_code; });
}

function loadFixture(provider) {
  return JSON.parse(readFileSync(new URL("../../curriculum/fixtures/" + provider + ".json", import.meta.url), "utf8"));
}

function identity(provider, row) {
  if (provider === "cambridge" || provider === "ib") return row.stage_key + "|" + row.external_code;
  return row.stage_key + "|" + loose(row.display_name);
}

function subjectGroup(row) {
  return row && row.metadata
    ? (row.metadata.group_key || row.metadata.group || row.metadata.subject_group || null)
    : null;
}

function isManualCbseInternal(row) {
  if (!row || !row.metadata) return false;
  const group = loose(row.metadata.group || row.metadata.category || "");
  return group === "internal" || group === "internal assessment";
}

function compare(provider, generated, current) {
  // CBSE's internal-assessment rows are preserved in Axon but are not exposed
  // consistently as normal subject-list entries in the first-party HTML.
  // Never auto-retire them from a missing <li>; they remain manually reconciled.
  const generatedForCompare = provider === "cbse"
    ? generated.filter(function (row) { return !isManualCbseInternal(row); })
    : generated;
  const next = new Map(generatedForCompare.map(function (row) { return [identity(provider, row), row]; }));
  const activeCurrent = current.filter(function (row) {
    if (row.availability !== "active") return false;
    if (provider === "cbse" && isManualCbseInternal(row)) return false;
    return true;
  });
  const prev = new Map(activeCurrent.map(function (row) { return [identity(provider, row), row]; }));
  const added = [...next.keys()].filter(function (key) { return !prev.has(key); }).sort();
  const removed = [...prev.keys()].filter(function (key) { return !next.has(key); }).sort();
  const added_details = added.map(function (key) {
    const row = next.get(key);
    return {
      key: key,
      external_code: row.external_code || null,
      source_url: row.source_url || null,
      category: row.metadata ? (row.metadata.category || row.metadata.group || null) : null
    };
  });
  const removed_details = removed.map(function (key) {
    const row = prev.get(key);
    return {
      key: key,
      external_code: row.external_code || null,
      source_url: row.source_url || null,
      category: row.metadata ? (row.metadata.category || row.metadata.group || null) : null
    };
  });
  const changed = [];

  for (const entry of next.entries()) {
    const key = entry[0];
    const row = entry[1];
    const old = prev.get(key);
    if (!old) continue;
    const fields = provider === "ib"
      ? ["display_name", "levels_supported"]
      : provider === "cambridge"
        ? ["display_name", "variant"]
        : ["display_name", "external_code"];
    const delta = fields.filter(function (field) {
      if (field === "display_name") return loose(old[field]) !== loose(row[field]);
      return JSON.stringify(old[field] || null) !== JSON.stringify(row[field] || null);
    });
    if (provider === "ib" && loose(subjectGroup(old)) !== loose(subjectGroup(row))) {
      delta.push("subject_group");
    }
    if (delta.length) changed.push({ key: key, fields: delta });
  }
  return {
    provider: provider,
    generated: generated.length,
    current: current.length,
    added: added,
    removed: removed,
    added_details: added_details,
    removed_details: removed_details,
    changed: changed
  };
}

export function validateFixture(provider, data) {
  data = data || loadFixture(provider);
  const rows = data.offerings || [];
  const errors = [];
  if (!Array.isArray(rows) || !rows.length) errors.push("fixture has no offerings");

  for (const row of rows) {
    if (row.provider !== provider) errors.push("wrong provider on " + row.display_name);
    if (!row.programme_key || !row.stage_key || !row.display_name) errors.push("missing identity field on " + JSON.stringify(row));
    if (!row.source_url || !row.source_url.startsWith("https://")) errors.push("missing source URL on " + row.display_name);
    if (!row.source_version) errors.push("missing source version on " + row.display_name);
    const host = row.source_url ? new URL(row.source_url).hostname.replace(/^www\./, "") : "";
    const allowedHost = provider === "cambridge"
      ? host === "cambridgeinternational.org"
      : provider === "cbse"
        ? host === "cbseacademic.nic.in"
        : host === "ibo.org";
    if (!allowedHost) errors.push("non-first-party source URL on " + row.display_name + ": " + host);
    if (provider === "cambridge" && !/^\d{4}$/.test(row.external_code || "")) errors.push("invalid Cambridge code on " + row.display_name);
    if (provider === "ib") {
      if (!/^\d{6}$/.test(row.external_code || "")) errors.push("invalid IB code on " + row.display_name);
      if (!subjectGroup(row)) errors.push("missing IB group on " + row.display_name);
      if (!Array.isArray(row.levels_supported) || !row.levels_supported.length) errors.push("missing IB level on " + row.display_name);
    }
  }

  const active = rows.filter(function (row) { return row.availability === "active"; });
  const ids = active.map(function (row) {
    if (provider === "cbse") {
      return row.stage_key + "|" + (row.external_code || loose(row.display_name));
    }
    return identity(provider, row);
  });
  if (new Set(ids).size !== ids.length) errors.push("duplicate active offering identity");
  const minimum = { cambridge: 250, cbse: 300, ib: 300 }[provider];
  if (rows.length < minimum) errors.push("count regression: " + rows.length + " < " + minimum);
  return errors;
}

async function generate() {
  const keys = ["cambridge_igcse", "cambridge_advanced", "cbse_curriculum", "cbse_skill"];
  const fetched = {};
  await Promise.all(keys.map(async function (key) { fetched[key] = await fetchBytes(SOURCES[key]); }));

  const cambridge = [
    ...parseCambridgeIgcse(fetched.cambridge_igcse.bytes.toString("utf8")),
    ...parseCambridgeAdvanced(fetched.cambridge_advanced.bytes.toString("utf8"))
  ];
  const cbse = sortedUnique([
    // Put the dedicated skill catalog first so its official subject codes win
    // over duplicate uncoded names also linked from the general curriculum.
    ...parseCbseSkill(fetched.cbse_skill.bytes.toString("utf8")),
    ...parseCbseCurriculum(fetched.cbse_curriculum.bytes.toString("utf8"))
  ], function (row) { return row.stage_key + "|" + loose(row.display_name); });

  const generated = { cambridge: cambridge, cbse: cbse };
  const sourceMeta = Object.fromEntries(keys.map(function (key) {
    return [key, Object.assign({}, SOURCES[key], {
      sha256: fetched[key].sha256,
      fetched_at: fetched[key].fetched_at
    })];
  }));
  const unavailable = {};

  // IBO currently returns HTTP 403 to GitHub-hosted automation for this public
  // PDF. Respect that response. An admin can download the official PDF through
  // normal first-party access and pass its local path here; the same parser,
  // hash and diff logic is then used without bypassing the provider's controls.
  const ibPath = process.env.AXON_IB_CATALOG_PDF;
  if (ibPath) {
    const bytes = readFileSync(ibPath);
    generated.ib = parseIbText(pdfText(bytes));
    sourceMeta.ibdp_subjects = Object.assign({}, SOURCES.ibdp_subjects, {
      sha256: sha256(bytes),
      fetched_at: new Date().toISOString(),
      acquisition: "admin-supplied-official-file"
    });
  } else {
    unavailable.ib = "manual official-PDF reconciliation required; set AXON_IB_CATALOG_PDF to the downloaded first-party PDF";
  }

  return { generated: generated, source_meta: sourceMeta, unavailable: unavailable };
}

function printReport(report) {
  for (const item of report) {
    console.log("\n" + item.provider + ": source=" + item.generated + " fixture=" + item.current);
    if (item.added.length) {
      console.log("  added (" + item.added.length + "):");
      for (const row of item.added_details) {
        console.log("    " + row.key
          + (row.external_code ? " code=" + row.external_code : "")
          + (row.category ? " category=" + row.category : "")
          + (row.source_url ? " source=" + row.source_url : ""));
      }
    }
    if (item.removed.length) {
      console.log("  removed (" + item.removed.length + "):");
      for (const row of item.removed_details) {
        console.log("    " + row.key
          + (row.external_code ? " code=" + row.external_code : "")
          + (row.category ? " category=" + row.category : "")
          + (row.source_url ? " source=" + row.source_url : ""));
      }
    }
    if (item.changed.length) console.log("  changed (" + item.changed.length + "):\n    " + item.changed.map(function (x) { return x.key + ": " + x.fields.join(","); }).join("\n    "));
    if (!item.added.length && !item.removed.length && !item.changed.length) console.log("  no catalog drift");
  }
}

async function main() {
  const command = process.argv[2] || "validate";

  if (command === "validate") {
    let failed = false;
    for (const provider of ["cambridge", "cbse", "ib"]) {
      const errors = validateFixture(provider);
      if (errors.length) {
        failed = true;
        console.error(provider + " fixture:\n- " + errors.join("\n- "));
      } else {
        console.log(provider + " fixture OK (" + loadFixture(provider).offerings.length + " offerings)");
      }
    }
    if (failed) process.exitCode = 1;
    return;
  }

  if (command !== "check" && command !== "snapshot") {
    throw new Error("Usage: node scripts/curriculum/catalog.mjs [validate|check|snapshot]");
  }

  const result = await generate();
  const checkedProviders = Object.keys(result.generated);
  const report = checkedProviders.map(function (provider) {
    return compare(provider, result.generated[provider], loadFixture(provider).offerings);
  });
  printReport(report);
  for (const entry of Object.entries(result.unavailable)) {
    console.warn("\n" + entry[0] + ": SOURCE NOT CHECKED — " + entry[1]);
  }

  if (command === "snapshot") {
    const generatedDir = new URL("../../curriculum/generated/", import.meta.url);
    mkdirSync(generatedDir, { recursive: true });
    for (const provider of checkedProviders) {
      const path = new URL("../../curriculum/generated/" + provider + ".json", import.meta.url);
      writeFileSync(path, JSON.stringify({
        schema_version: 1,
        generated_at: new Date().toISOString(),
        provider: provider,
        source_meta: result.source_meta,
        offerings: result.generated[provider]
      }, null, 2) + "\n");
    }
  }

  const drift = report.some(function (item) {
    return item.added.length || item.removed.length || item.changed.length;
  });
  if (command === "check" && drift) {
    console.error("\nOfficial catalog drift detected. Review a generated snapshot before production activation.");
    process.exitCode = 2;
  }
}

const invoked = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
if (invoked) {
  main().catch(function (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}
