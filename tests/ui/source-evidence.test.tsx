import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
const fixture = vi.hoisted(() => ({ pageImageUrl: vi.fn() }));
vi.mock("../../src/scan/crops.js", () => ({ pageImageUrl: fixture.pageImageUrl }));
vi.mock("../../src/ui/components/Crop", () => ({ default: () => <div>Question crop pixels</div> }));
import SourceEvidence from "../../src/ui/components/SourceEvidence";
beforeEach(() => { fixture.pageImageUrl.mockReset().mockResolvedValue("https://example.test/page.png"); });

test("full-page inspection only offers the recorded source pages and bounded zoom", async () => {
  render(<SourceEvidence paperId="paper" pageNumber={2} pageNumbers={[2, 4]} box={{ x: 0, y: 0, w: 10, h: 10 }} />);
  const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Full saved page" }));
  const image = await screen.findByRole("img", { hidden: true }); fireEvent.load(image);
  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect((image as HTMLElement).style.width).toBe("150%");
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["2", "4"]);
  await user.selectOptions(screen.getByRole("combobox", { name: "Source page" }), "4");
  expect(await screen.findByRole("img", { hidden: true })).toBeTruthy();
  expect(fixture.pageImageUrl).toHaveBeenCalledWith("paper", 4, { force: false });
});

test("a source request resolving after a paper switch never reveals the previous paper", async () => {
  let resolveOld!: (url: string) => void;
  fixture.pageImageUrl.mockImplementation((paper: string) => paper === "old" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve("https://example.test/new.png"));
  const view = render(<SourceEvidence paperId="old" pageNumber={1} box={null} />);
  await act(async () => { await Promise.resolve(); });
  view.rerender(<SourceEvidence paperId="new" pageNumber={1} box={null} />);
  expect((await screen.findByRole("img", { hidden: true }) as HTMLImageElement).src).toBe("https://example.test/new.png");
  await act(async () => { resolveOld("https://example.test/old.png"); });
  expect((screen.getByRole("img", { hidden: true }) as HTMLImageElement).src).toBe("https://example.test/new.png");
});

test("unavailable source remains explicit and can be retried without invented pixels", async () => {
  fixture.pageImageUrl.mockResolvedValueOnce(null);
  render(<SourceEvidence paperId="paper" pageNumber={1} box={null} />);
  expect(await screen.findByText(/We could not show saved page 1/)).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Try page again" }));
  expect(await screen.findByRole("img", { hidden: true })).toBeTruthy();
  expect(fixture.pageImageUrl).toHaveBeenLastCalledWith("paper", 1, { force: true });
});
