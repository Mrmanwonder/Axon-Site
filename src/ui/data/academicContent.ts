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
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  const cells = value.split("|").map(cell => cell.trim());
  return cells.length >= 2 ? cells : null;
}
function isSeparator(cells: string[]) {
  return cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

/** Only a markdown separator or the documented X/P distribution proves a table. */
export function academicBlocks(source: string): AcademicBlock[] {
  const lines = normalizeAcademicText(source).split("\n");
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
