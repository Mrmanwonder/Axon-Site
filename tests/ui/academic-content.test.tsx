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

