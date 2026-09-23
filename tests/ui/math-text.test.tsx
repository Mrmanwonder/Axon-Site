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
