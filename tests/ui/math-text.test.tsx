import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import MathText, { renderSafeLatex } from "../../src/ui/components/MathText";

test("explicit inline and display LaTeX render through KaTeX", () => {
  const { container } = render(
    <MathText text={"Use \\(P(X=0)=e^{-\\lambda n}\\), then \\[n < 6.42\\]."} />,
  );
  expect(container.querySelectorAll(".katex").length).toBe(2);
  expect(container.querySelector(".math-display")).not.toBeNull();
});

test("legacy model notation is upgraded instead of shown like source code", () => {
  const { container } = render(
    <MathText text={"Set e^(-lambda * n) > 0.95. Then -lambda * n > ln(0.95)."} />,
  );
  expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
  expect(container.textContent).toContain("Set");
});

test("unsafe or malformed LaTeX falls back to source text without throwing", () => {
  expect(renderSafeLatex("\\href{https://example.com}{x}")).toBeNull();
  expect(renderSafeLatex("\\frac{")).toBeNull();

  const { container } = render(<MathText text={"\\(\\href{https://example.com}{x}\\)"} />);
  expect(container.querySelector("a")).toBeNull();
  expect(container.querySelector(".katex")).toBeNull();
  expect(container.textContent).toContain("\\href");
});


test("single-dollar LaTeX and unicode superscripts render without exposing source notation", () => {
  const { container } = render(
    <MathText text={"Use $x^2 + y^2 = r^2$ and then compare x² >= 4."} />,
  );
  expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
  expect(container.textContent).not.toContain("x²");
});

test("ordinary dollar prose is not mistaken for maths", () => {
  const { container } = render(
    <MathText text={"The tickets were $20 and $30 after the discount."} />,
  );
  expect(container.querySelector(".katex")).toBeNull();
  expect(container.textContent).toContain("$20 and $30");
});

test("valid bare LaTeX commands do not acquire a second backslash", () => {
  const { container } = render(<MathText text={"e^{-\\lambda n} = \\frac{1}{2}"} />);
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector(".math-raw")).toBeNull();
});

test("historical escaped square roots and fractions retain working line breaks", () => {
  const { container } = render(<MathText text={"\\\\sqrt{\\\\frac{9}{4}}\\\\n X=1.5"} />);
  expect(container.querySelectorAll(".katex")).toHaveLength(2);
  expect(container.querySelector("br")).not.toBeNull();
  expect(container.textContent).not.toContain("\\n");
  expect(container.querySelector(".math-raw")).toBeNull();
  expect([...container.querySelectorAll(".katex-html")].map(node => node.textContent).join("")).not.toContain("\\sqrt");
  expect(container.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe("\\sqrt{\\frac{9}{4}}");
});

test("faithful student algebra is typeset without being corrected", () => {
  const { container } = render(<MathText text={"\\(2+2=5\\)\n\\(E^{4}C^{3}\\)"} />);
  expect(container.querySelectorAll(".katex")).toHaveLength(2);
  expect(container.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe("2+2=5");
});

test("matrix row separators survive the escaping boundary", () => {
  const latex = "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}";
  expect(renderSafeLatex(latex)).not.toBeNull();
});

test("bare fractions render inline while surrounding prose stays prose", () => {
  const { container } = render(<MathText text={"Use \\frac{1}{2} as the probability."} />);
  expect(container.querySelectorAll(".katex")).toHaveLength(1);
  expect(container.textContent).toContain("Use ");
  expect(container.textContent).toContain(" as the probability.");
});

test("bare matrix environments are typeset without becoming tables", () => {
  const { container } = render(<MathText text={"\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}"} />);
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector("table")).toBeNull();
});

test("bare LaTeX inside a printed question is typeset, and the prose around it stays prose", () => {
  const text = "1. A summary of 60 values of x gives \\sum(x-c) = 642, \\quad \\sum(x-c)^2 = 32\\,460, where c is a constant. [2]";
  const { container } = render(<MathText text={text} />);
  // KaTeX keeps the TeX source in a MathML annotation for screen readers; what
  // a student sees is everything else.
  const visible = container.cloneNode(true) as HTMLElement;
  visible.querySelectorAll(".katex-mathml").forEach((n) => n.remove());
  const plain = visible.textContent ?? "";
  expect(container.querySelectorAll(".math-rendered").length).toBeGreaterThanOrEqual(1);
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(plain).not.toContain("\\sum");
  expect(plain).not.toContain("\\quad");
  expect(plain).not.toContain("\\,");
  expect(plain).toContain("where c is a constant.");
});

test("a written answer with \\text{} words is typeset as one expression", () => {
  const text = "\\text{a head} = \\frac{1}{3} \\times \\frac{4}{9} + \\frac{1}{3} \\times \\frac{4}{27}";
  const { container } = render(<MathText text={text} />);
  const visible = container.cloneNode(true) as HTMLElement;
  visible.querySelectorAll(".katex-mathml").forEach((n) => n.remove());
  const plain = visible.textContent ?? "";
  expect(plain).not.toContain("\\text");
  expect(plain).not.toContain("\\times");
  expect(plain).toMatch(/a\s+head/u);
});

/** What a student sees: everything except KaTeX's screen-reader MathML copy. */
function visibleText(container: HTMLElement): string {
  const visible = container.cloneNode(true) as HTMLElement;
  visible.querySelectorAll(".katex-mathml").forEach((n) => n.remove());
  // KaTeX sets the space inside \\text{} as a non-breaking space.
  return (visible.textContent ?? "").replace(/\u00a0/g, " ");
}

test("a multi-line array environment in an answer typesets as one table, and the working after it still renders", () => {
  const text = [
    "\\begin{array}{|c|c|c|c|c|}",
    "\\hline",
    "X & 0 & 1 & 2 & 3 \\\\",
    "\\hline",
    "P & \\frac{1}{56} & \\frac{15}{56} & \\frac{15}{28} & \\frac{5}{28} \\\\",
    "\\hline",
    "\\end{array}",
    "\\frac{3}{8} \\times \\frac{2}{7} \\times \\frac{1}{6} = \\frac{1}{56}",
    "\\frac{5}{8} \\times \\frac{4}{7} \\times \\frac{3}{6} = \\frac{5}{28}",
  ].join("\n");
  const { container } = render(<MathText text={text} />);
  expect(container.querySelector(".math-raw")).toBeNull();
  const display = container.querySelectorAll(".math-display");
  expect(display).toHaveLength(1);
  // KaTeX lays an array out as a grid of columns (.col-align-c) with rules for |.
  expect(display[0].querySelectorAll(".col-align-c").length).toBe(5);
  expect(display[0].querySelector(".katex-hline")).not.toBeNull();
  expect(display[0].querySelector(".vertical-separator")).not.toBeNull();
  // Table plus the two working lines.
  expect(container.querySelectorAll(".katex")).toHaveLength(3);
  // The student's line break between the two working lines survives.
  expect(container.querySelectorAll("br")).toHaveLength(1);
  const plain = visibleText(container);
  expect(plain).not.toContain("\\begin");
  expect(plain).not.toContain("\\hline");
  expect(plain).not.toContain("\\frac");
});

test("prose around a multi-line environment keeps its own lines", () => {
  const text = "The distribution is\n\\begin{aligned}\na &= 1 \\\\\nb &= 2\n\\end{aligned}\nso the total is 3.";
  const { container } = render(<MathText text={text} />);
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(container.querySelectorAll(".math-display")).toHaveLength(1);
  const plain = visibleText(container);
  expect(plain).toContain("The distribution is");
  expect(plain).toContain("so the total is 3.");
});

test.each([
  ["tabular", "\\begin{tabular}{|l|c|}\n\\hline\nTotal marks & 5 \\\\\n\\hline\n\\end{tabular}"],
  ["matrix", "\\begin{matrix}\n1 & 2 \\\\\n3 & 4\n\\end{matrix}"],
  ["pmatrix", "\\begin{pmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{pmatrix}"],
  ["bmatrix", "\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}"],
  ["align", "\\begin{align}\nx &= 2 \\\\\ny &= 3\n\\end{align}"],
  ["align*", "\\begin{align*}\nx &= 2 \\\\\ny &= 3\n\\end{align*}"],
  ["cases", "f(x) = \\begin{cases}\n1 & x > 0 \\\\\n0 & x \\le 0\n\\end{cases}"],
  ["gathered", "\\begin{gathered}\nx = 2 \\\\\ny = 3\n\\end{gathered}"],
])("a multi-line %s environment typesets instead of showing source", (_name, text) => {
  const { container } = render(<MathText text={text} />);
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(container.querySelector(".math-display .katex")).not.toBeNull();
  expect(visibleText(container)).not.toContain("\\begin");
});

test("tabular words stay readable prose inside the typeset table", () => {
  const { container } = render(<MathText text={"\\begin{tabular}{|l|c|}\nTotal marks & 5\n\\end{tabular}"} />);
  expect(visibleText(container)).toContain("Total marks");
});

test("an environment KaTeX cannot parse falls back to its source, line breaks intact", () => {
  const text = "\\begin{array}{|c|c|}\nX & \\frac{1}{ \\\\\n\\end{array}";
  const { container } = render(<MathText text={text} />);
  const raw = container.querySelector(".math-raw");
  expect(raw).not.toBeNull();
  expect(raw?.textContent).toBe(text);
});

test("mixed prose and maths on one line renders \\text, \\$, \\% and ^{th}", () => {
  const text = "\\text{median} = 10^{th} pos = \\$32,000\nUQ = 75\\% \\times 19 = 15^{th}";
  const { container } = render(<MathText text={text} />);
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(container.querySelectorAll(".katex")).toHaveLength(2);
  expect(container.querySelectorAll("br")).toHaveLength(1);
  const plain = visibleText(container);
  expect(plain).not.toContain("\\text");
  expect(plain).not.toContain("\\$");
  expect(plain).not.toContain("\\%");
  expect(plain).not.toContain("^{");
  expect(plain).toContain("median");
  expect(plain).toContain("pos");
  expect(plain).toContain("$32,000");
  expect(plain).toContain("75%");
});

test("an escaped dollar is never the opening of single-dollar maths", () => {
  const { container } = render(<MathText text={"\\text{cost} = \\$5 + \\$7 = \\$12"} />);
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(visibleText(container)).toContain("$12");
});

test("the review card's AcademicText renders the same array answer as a table", async () => {
  const { default: AcademicText } = await import("../../src/ui/components/AcademicText");
  const text = "\\begin{array}{|c|c|}\n\\hline\nX & 0 \\\\\n\\hline\nP & \\frac{1}{56} \\\\\n\\hline\n\\end{array}\n\\frac{1}{56} = \\frac{1}{56}";
  const { container } = render(<AcademicText text={text} />);
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(container.querySelector(".math-display .katex-hline")).not.toBeNull();
  expect(container.querySelectorAll(".katex")).toHaveLength(2);
});

/*
 * AXO-139 production gate: shapes copied from the owner's own saved papers
 * (5 Oct screenshots and the production audit on 6 Oct). Normal reading must
 * show no raw TeX command, brace or delimiter.
 */
test.each([
  ["\\text{} inside fractions", "\\frac{\\text{a head}}{\\text{no red}} = \\frac{\\frac{1}{3}}{\\frac{10}{27}} = \\frac{9}{10}"],
  ["\\sum and \\quad in question prose", "Given that \\sum(x-c) = 642, \\quad \\sum(x-c)^2 = 32\\,460, where c is a constant, find the mean."],
  ["\\Sigma in question prose", "\\Sigma(x - 200) = 446 and \\Sigma x = 6846."],
  ["combinations with a leading superscript", "^{4}\\text{C}_1 \\times 3! \\times 3! = 144"],
  ["combinations with an empty base", "^{9}C_{6} \\times {}^{3}C_{3} = 84 \\times 1 = 84 \\text{ different ways}"],
  ["words beside \\times", "O No No \\times 3 = \\frac{4}{12} \\times \\frac{8}{11} \\times 3 = \\frac{28}{55}"],
  ["ordinals and an escaped dollar", "\\text{median} = 10^{th}\\text{ pos} = \\$32,000"],
  ["a bare percent sign", "Small = 20% = (S \\le x)"],
  ["percent in working", "UQ = 75\\% \\times 19 = 15^{th}\\text{ pos}"],
])("production example renders without raw TeX: %s", (_name, text) => {
  const { container } = render(<MathText text={text} />);
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector(".math-raw")).toBeNull();
  expect(visibleText(container)).not.toMatch(/\\[A-Za-z]+|\^\{|_\{|\{\}/);
});

test("a bare percent sign is a percent, never a TeX comment that swallows the line", () => {
  const html = renderSafeLatex("20% = (S \\le x)");
  expect(html).not.toBeNull();
  expect(html).toContain("%");
  expect(html).toContain("≤");
});
