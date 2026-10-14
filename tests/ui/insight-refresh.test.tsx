import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const fixture = vi.hoisted(() => ({ app: {} as any, read: vi.fn() }));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => fixture.app }));
vi.mock("../../src/ui/data/modules", () => ({ insightEvidence: fixture.read, syllabusMapData: vi.fn() }));
vi.mock("../../src/cache.js", () => ({ getCached: async () => null }));
import { useInsightEvidence } from "../../src/ui/data/useInsights";
const evidence = (cause: string) => ({ data: { attempts: [], losses: [{ cause }], felt: [], difficulty: [] } });
beforeEach(() => {
  fixture.read.mockReset().mockResolvedValue(evidence("old"));
  fixture.app = { student: { id: "a" }, papers: [{ id: "p", total_awarded: 4, total_available: 5 }], papersResource: { state: "ready", data: [], fetchedAt: 1 } };
});
afterEach(() => vi.useRealTimers());
test("same-total library refresh invalidates evidence, while filter/rerender does not", async () => {
  const { result, rerender } = renderHook(useInsightEvidence);
  await waitFor(() => expect(result.current.resource.state).toBe("ready"));
  rerender(); expect(fixture.read).toHaveBeenCalledTimes(1);
  fixture.read.mockResolvedValue(evidence("corrected"));
  fixture.app = { ...fixture.app, papers: [...fixture.app.papers], papersResource: { ...fixture.app.papersResource, fetchedAt: 2 } };
  rerender();
  await waitFor(() => expect(result.current.resource.data?.losses[0].cause).toBe("corrected"));
  expect(fixture.read).toHaveBeenCalledTimes(2);
});
test("visible polling refreshes evidence-only changes; failed refresh retains stale evidence", async () => {
  const { result, unmount } = renderHook(useInsightEvidence);
  await waitFor(() => expect(result.current.resource.state).toBe("ready"));
  fixture.read.mockRejectedValueOnce(new Error("offline"));
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(result.current.resource).toMatchObject({ state: "failed", data: evidence("old").data });
  fixture.read.mockResolvedValue(evidence("updated"));
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.resource.data?.losses[0].cause).toBe("updated");
  unmount(); const calls = fixture.read.mock.calls.length;
  window.dispatchEvent(new Event("online")); expect(fixture.read).toHaveBeenCalledTimes(calls);
});
test("a late previous-profile answer cannot replace the current profile", async () => {
  let resolve!: (value: any) => void;
  fixture.read.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const { result, rerender } = renderHook(useInsightEvidence);
  fixture.app = { ...fixture.app, student: { id: "b" } }; fixture.read.mockResolvedValue(evidence("b")); rerender();
  await waitFor(() => expect(result.current.resource.data?.losses[0].cause).toBe("b"));
  await act(async () => resolve(evidence("a")));
  expect(result.current.resource.data?.losses[0].cause).toBe("b");
});
