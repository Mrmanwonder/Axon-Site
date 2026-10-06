import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import AcademicText from "../../src/ui/components/AcademicText";
import { academicBlocks, normalizeAcademicText } from "../../src/ui/data/academicContent";

afterEach(cleanup);

test("the source X/P distribution keeps exact cell values and semantic headers", () => {
  const source = "X | 0 | 1 | 2 | 3\nP | 1/4 | 3/8 | 1/4 | 1/8";
  expect(academicBlocks(source)).toEqual([{ kind: "table",
    rows: [["X", "0", "1", "2", "3"], ["P", "1/4", "3/8", "1/4", "1/8"]],
    header: false, rowHeaders: true }]);
  const { container } = render(<AcademicText text={source} />);
  expect(container.querySelectorAll("table tr")).toHaveLength(2);
  expect(container.querySelectorAll("th[scope=row]")).toHaveLength(2);
  expect(container.querySelectorAll("th[scope=col]")).toHaveLength(4);
  expect(container.querySelectorAll("td .katex")).toHaveLength(4);
  const region = container.querySelector(".academic-table-scroll")!;
  expect(region.getAttribute("tabindex")).toBe("0");
});

test("blank cells are kept in their original columns", () => {
  const blocks = academicBlocks("X | 0 | 1\nP | 1/4 | ");
  expect(blocks[0]).toMatchObject({ kind: "table", rows: [["X", "0", "1"], ["P", "1/4", ""]] });
});

test("markdown data tables retain ordered headers and rows", () => {
  const source = "| Outcome | Frequency |\n| --- | ---: |\n| HH | 2 |\n| HT | 1 |";
  const { container } = render(<AcademicText text={source} />);
  expect(container.querySelectorAll("thead th")).toHaveLength(2);
  expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(container.querySelector("tbody td")?.textContent).toBe("HH");
});

test.each([
  "X | 0 | 1\nP | 1/4\nOther | no | values",
  "x | y | z\n1 | 2 | 3",
  "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",
])("ambiguous/ragged pipes and matrix notation are never guessed into data tables: %s", source => {
  expect(academicBlocks(source).every(block => block.kind === "text")).toBe(true);
  const { container } = render(<AcademicText text={source} />);
  expect(container.querySelector("table")).toBeNull();
});

test("escaping compatibility is bounded and idempotent", () => {
  const source = "\\\\sqrt{\\\\frac{9}{4}}\\\\n X=1.5";
  const normalized = normalizeAcademicText(source);
  expect(normalized).toBe("\\sqrt{\\frac{9}{4}}\n X=1.5");
  expect(normalizeAcademicText(normalized)).toBe(normalized);
  const environment = "\\begin{aligned}x&=1\\\\y&=2\\end{aligned}";
  expect(normalizeAcademicText(environment)).toBe(environment);
  const prose = "Use \\nu and \\nabla. The file is C:\\new\\notes.";
  expect(normalizeAcademicText(prose)).toBe(prose);
});

test("untrusted table cells do not execute HTML or links", () => {
  const { container } = render(<AcademicText text={"| Label | Value |\n| --- | --- |\n| <img src=x onerror=alert(1)> | $\\href{https://example.com}{x}$ |"} />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toContain("<img");
});

test("a LaTeX array becomes a real table, and the working under it still typesets (owner, 6 Oct 2026)", () => {
  const text = [
    "\\begin{array}{|c|c|c|c|c|}", "\\hline", "X & 0 & 1 & 2 & 3 \\\\", "\\hline",
    "P & \\frac{1}{56} & \\frac{15}{56} & \\frac{15}{28} & \\frac{5}{28} \\\\", "\\hline", "\\end{array}", "",
    "\\frac{3}{8} \\times \\frac{2}{7} \\times \\frac{1}{6} = \\frac{1}{56}",
  ].join("\n");
  const blocks = academicBlocks(text);
  expect(blocks[0]).toEqual({
    kind: "table", header: false, rowHeaders: true,
    rows: [["X", "0", "1", "2", "3"], ["P", "\\frac{1}{56}", "\\frac{15}{56}", "\\frac{15}{28}", "\\frac{5}{28}"]],
  });
  expect(blocks[1]).toEqual({ kind: "text", text: "\\frac{3}{8} \\times \\frac{2}{7} \\times \\frac{1}{6} = \\frac{1}{56}" });
  const { container } = render(<AcademicText text={text} />);
  expect(container.querySelectorAll("table th, table td").length).toBe(10);
  expect(container.textContent).not.toContain("\\hline");
  expect(container.textContent).not.toContain("\\begin");
});

test("a ragged LaTeX array is kept as source rather than shifting a column", () => {
  const text = "\\begin{array}{cc} a & b \\\\ c \\end{array}";
  expect(academicBlocks(text)[0].kind).toBe("text");
});
