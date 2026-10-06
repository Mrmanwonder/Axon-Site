/**
 * Display compatibility for historical model strings, never a storage rewrite.
 * Decode a single known escaping layer only in mathematical/table content.
 * Actual LaTeX environments keep their \\ row separators verbatim.
 */
export function normalizeAcademicText(source: string): string {
  if (/\\begin\s*\{/.test(source)) return source;
  const academic = /\\{1,2}(?:frac|tfrac|dfrac|sqrt|sum|prod|int|binom|lambda|mu|sigma|theta|pi|left|right|[([])/.test(source)
    || /(?:^|\\n|\n)\s*X\s*\|/.test(source);
  if (!academic) return source;
  return source
    .replace(/(?<!\\)\\\\(?=(?:frac|tfrac|dfrac|sqrt|sum|prod|int|binom|lambda|mu|sigma|theta|pi|rho|alpha|beta|gamma|delta|left|right)\b|[()[\]])/g, "\\")
    .replace(/(?<!\\)\\{1,2}n(?=\s|$|\\|[A-Z0-9(])/g, "\n");
}

export type AcademicBlock =
  | { kind: "text"; text: string }
  | { kind: "table"; rows: string[][]; header: boolean; rowHeaders: boolean };

function cellsFor(line: string): string[] | null {
  if (!line.includes("|") || /\\\||\\begin\s*\{/.test(line)) return null;
  let value = line.trim();
  const outerPipes = value.startsWith("|");
  if (outerPipes) value = value.slice(1);
  // Without a leading outer pipe, a trailing delimiter is an empty final
  // cell. Never silently discard it or move another value into its column.
  if (outerPipes && value.endsWith("|")) value = value.slice(0, -1);
  const cells = value.split("|").map(cell => cell.trim());
  return cells.length >= 2 ? cells : null;
}
function isSeparator(cells: string[]) {
  return cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

const ENVIRONMENT = /\\begin\s*\{(array|tabular|aligned|align\*?|matrix|pmatrix|bmatrix|cases)\}[\s\S]*?\\end\s*\{\1\}/g;

/**
 * A LaTeX array or tabular, as rows of cells: `&` between cells, `\\` between
 * rows, `\hline` and the column spec dropped. Null when it is not a clean grid,
 * so a ragged table stays visible as source rather than shifting a column.
 */
export function latexTable(env: string): AcademicBlock | null {
  const m = env.match(/^\\begin\s*\{(array|tabular)\}\s*(?:\{[^{}]*\})?([\s\S]*)\\end\s*\{\1\}$/);
  if (!m) return null;
  const rows = m[2]
    .replace(/\\(?:hline|toprule|midrule|bottomrule)\b/g, "")
    .split(/\\\\(?:\[[^\]]*\])?/)
    .map(row => row.trim())
    .filter(Boolean)
    .map(row => row.split(/(?<!\\)&/).map(cell => cell.trim()));
  if (!rows.length || rows[0].length < 2 || rows.some(row => row.length !== rows[0].length)) return null;
  const rowHeaders = rows.length >= 2 && rows.every(row => /^(?:[A-Za-z]{1,3}|P\s*\(.*\)|\\text\{[^{}]+\})$/.test(row[0]));
  return { kind: "table", rows: rows.map(row => row.map(cell => cell.replace(/^\\text\{([^{}]*)\}$/, "$1"))), header: false, rowHeaders };
}

/** Only a markdown separator, the documented X/P distribution, or a LaTeX array proves a table. */
export function academicBlocks(source: string): AcademicBlock[] {
  // A LaTeX environment spans lines. Take each one out whole first: an array
  // becomes a real table (owner, 6 Oct 2026: "the table is just not
  // recognised"), and any other environment stays one block so it typesets.
  const normalized = normalizeAcademicText(source);
  if (/\\begin\s*\{/.test(normalized)) {
    const out: AcademicBlock[] = [];
    let last = 0;
    for (const match of normalized.matchAll(ENVIRONMENT)) {
      const index = match.index ?? 0;
      const before = normalized.slice(last, index).replace(/^\n+|\n+$/g, "");
      if (before.trim()) out.push(...linesToBlocks(before));
      out.push(latexTable(match[0]) ?? { kind: "text", text: match[0] });
      last = index + match[0].length;
    }
    const after = normalized.slice(last).replace(/^\n+|\n+$/g, "");
    if (after.trim()) out.push(...linesToBlocks(after));
    if (out.length) return out;
  }
  return linesToBlocks(normalized);
}

function linesToBlocks(text: string): AcademicBlock[] {
  const lines = text.split("\n");
  const blocks: AcademicBlock[] = [];
  let pending: string[] = [];
  const flush = () => {
    if (pending.length) blocks.push({ kind: "text", text: pending.join("\n") });
    pending = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const first = cellsFor(lines[i]);
    const second = i + 1 < lines.length ? cellsFor(lines[i + 1]) : null;
    if (!first || !second || first.length !== second.length) {
      pending.push(lines[i]); continue;
    }
    const markdown = isSeparator(second);
    const distribution = first.length >= 3 && /^X$/i.test(first[0]) && /^(?:P|P\s*\(\s*X\s*=\s*x\s*\))$/i.test(second[0]);
    if (!markdown && !distribution) { pending.push(lines[i]); continue; }

    // Read the complete contiguous pipe block. A ragged row invalidates the
    // entire block; dropping it would conceal uncertainty or shift a column.
    const rows = [first];
    let end = i + 1;
    let valid = true;
    if (distribution) rows.push(second);
    while (end + 1 < lines.length && lines[end + 1].includes("|")) {
      const cells = cellsFor(lines[++end]);
      if (!cells || cells.length !== first.length || isSeparator(cells)) valid = false;
      if (cells) rows.push(cells);
    }
    if (!valid || (markdown && rows.length < 2) || (distribution && rows.length !== 2)) {
      pending.push(...lines.slice(i, end + 1)); i = end; continue;
    }
    flush();
    blocks.push({ kind: "table", rows, header: markdown, rowHeaders: distribution });
    i = end;
  }
  flush();
  return blocks;
}
