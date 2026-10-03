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
  expect(container.textContent).not.toContain("\\sqrt");
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
