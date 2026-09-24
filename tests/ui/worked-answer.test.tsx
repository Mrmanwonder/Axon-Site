import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import WorkedAnswer from "../../src/ui/components/WorkedAnswer";

test("math-heavy legacy working becomes readable numbered steps", () => {
  const text =
    "Let lambda be the average number of accidents per day. " +
    "The probability of zero accidents is P(X=0) = e^(-lambda * n). " +
    "Set e^(-lambda * n) > 0.95. " +
    "Take natural logs: -lambda * n > ln(0.95). " +
    "Solve for n: n < ln(0.95) / -lambda.";

  const { container } = render(<WorkedAnswer text={text} />);

  expect(screen.getByRole("list", { name: "Worked solution steps" })).toBeTruthy();
  expect(container.querySelectorAll(".worked-steps > li")).toHaveLength(5);
  expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(4);
});

test("prose answers are separated into paragraphs rather than fake maths steps", () => {
  const { container } = render(
    <WorkedAnswer text={
      "Chlorophyll absorbs light energy. Carbon dioxide enters through the stomata. Glucose is produced during photosynthesis."
    } />,
  );

  expect(container.querySelector(".worked-steps")).toBeNull();
  expect(container.querySelectorAll(".worked-paragraphs > p")).toHaveLength(3);
});
