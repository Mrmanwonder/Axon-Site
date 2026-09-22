import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import PageSkeleton, { skeletonVariantForPath, type PageSkeletonVariant } from "../../src/ui/components/PageSkeleton";

afterEach(cleanup);

describe("PageSkeleton", () => {
  const variants: Array<[PageSkeletonVariant, string]> = [
    ["home", ".page-skeleton__next"],
    ["library", ".page-skeleton__search"],
    ["insights", ".page-skeleton__insights-grid"],
    ["paper", ".page-skeleton__score-card"],
    ["question", ".page-skeleton__question-card"],
    ["review", ".page-skeleton__review-scroll"],
    ["scan", ".page-skeleton__scan"],
    ["settings", ".page-skeleton__profile-card"],
    ["onboarding", ".page-skeleton__onboarding"],
    ["legal", ".page-skeleton__legal"],
  ];

  test.each(variants)("%s uses destination-specific geometry", (variant, sentinel) => {
    const { container } = render(<PageSkeleton variant={variant} label={`Loading ${variant}`} />);
    const status = screen.getByRole("status", { name: `Loading ${variant}` });
    expect(status.getAttribute("data-skeleton")).toBe(variant);
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(sentinel)).not.toBeNull();
  });

  test.each([
    ["/", "home"],
    ["/library", "library"],
    ["/library/paper-1", "paper"],
    ["/library/paper-1/q-2", "question"],
    ["/scan", "scan"],
    ["/scan/review/draft-1", "review"],
    ["/insights", "insights"],
    ["/settings", "settings"],
    ["/privacy", "legal"],
    ["/terms", "legal"],
    ["/cookies", "legal"],
  ] as const)("%s resolves to the %s skeleton", (pathname, expected) => {
    expect(skeletonVariantForPath(pathname)).toBe(expected);
  });
});
