import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  student: { id: "a" }, nextBestAction: vi.fn(), dueQueue: vi.fn(), focusAreas: vi.fn(),
  progressSummary: vi.fn(), practiceFlags: vi.fn(), setPracticePref: vi.fn(), practicePref: vi.fn(), targetGrades: vi.fn(),
}));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ student: mocks.student }) }));
vi.mock("../../src/ui/data/practice", () => ({ ...mocks, deviceTimeZone: () => "Asia/Kolkata" }));
import { useHomePractice } from "../../src/ui/data/useHomePractice";
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); mocks.student = { id: "a" };
  mocks.nextBestAction.mockResolvedValue({ state: "no_scans" }); mocks.dueQueue.mockResolvedValue([]);
  mocks.focusAreas.mockResolvedValue([]); mocks.progressSummary.mockResolvedValue({ session_dates: [], today: "2026-10-14" });
  mocks.practiceFlags.mockResolvedValue({ mistake_type_ui: false }); mocks.setPracticePref.mockResolvedValue({});
});
for (const [source, card] of [["nextBestAction", "nba"], ["dueQueue", "due"], ["focusAreas", "leaks"], ["progressSummary", "progress"], ["practiceFlags", "flags"]] as const) {
  test(`${source} failure preserves unrelated cards and independently recovers`, async () => {
    mocks[source].mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(useHomePractice);
    await waitFor(() => expect(result.current[card].resource.state).toBe("failed"));
    for (const other of ["nba", "due", "leaks", "progress", "flags"] as const) {
      if (other !== card) await waitFor(() => expect(result.current[other].resource.state).toBe("ready"));
    }
    const calls = mocks.nextBestAction.mock.calls.length;
    await act(() => result.current[card].reload());
    expect(result.current[card].resource.state).toBe("ready");
    if (card !== "nba") expect(mocks.nextBestAction).toHaveBeenCalledTimes(calls);
  });
}
test("failed refresh retains last good values; profile switch hides them and rejects late responses", async () => {
  const { result, rerender } = renderHook(useHomePractice);
  await waitFor(() => expect(result.current.nba.resource.state).toBe("ready"));
  mocks.nextBestAction.mockRejectedValueOnce(new Error("offline"));
  await act(() => result.current.nba.reload());
  expect(result.current.nba.resource).toMatchObject({ state: "failed", data: { state: "no_scans" }, retained: true });
  let resolve!: (data: unknown) => void;
  mocks.nextBestAction.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.nba.reload(); });
  await waitFor(() => expect(resolve).toBeTypeOf("function"));
  mocks.student = { id: "b" }; mocks.nextBestAction.mockResolvedValue({ state: "caught_up" }); rerender();
  expect(result.current.nba.resource.data).toBeNull();
  await waitFor(() => expect(result.current.nba.resource.data).toEqual({ state: "caught_up" }));
  await act(async () => { resolve({ state: "no_scans" }); await pending; });
  expect(result.current.nba.resource.data).toEqual({ state: "caught_up" });
});
test("timezone failure uses server timezone; unused preferences and targets cannot block Home", async () => {
  mocks.setPracticePref.mockRejectedValue(new Error("blocked"));
  mocks.practicePref.mockRejectedValue(new Error("failed")); mocks.targetGrades.mockRejectedValue(new Error("failed"));
  const { result } = renderHook(useHomePractice);
  await waitFor(() => expect(result.current.progress.resource.state).toBe("ready"));
  expect(mocks.setPracticePref).toHaveBeenCalledTimes(1);
  expect(mocks.practicePref).not.toHaveBeenCalled(); expect(mocks.targetGrades).not.toHaveBeenCalled();
});
