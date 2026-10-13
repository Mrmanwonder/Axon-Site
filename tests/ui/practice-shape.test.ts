import { beforeEach, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../src/ui/data/modules", () => ({ sb: { rpc } }));
import { dueQueue, nextBestAction, practiceFlags, progressSummary } from "../../src/ui/data/practice";

beforeEach(() => rpc.mockReset());

test("a reply in the wrong shape is a failed read, never a half-drawn card", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  await expect(nextBestAction("s")).rejects.toThrow(/unexpected answer/);
  await expect(progressSummary("s")).rejects.toThrow(/unexpected answer/);
  rpc.mockResolvedValue({ data: { state: "ready" }, error: null });
  await expect(nextBestAction("s")).rejects.toThrow(/unexpected answer/);
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(dueQueue("s")).rejects.toThrow(/unexpected answer/);
});

test("flags fail closed", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await practiceFlags()).toEqual({ mistake_type_ui: false, if_then_prompt: false });
  rpc.mockResolvedValue({ data: { mistake_type_ui: "true" }, error: null });
  expect((await practiceFlags()).mistake_type_ui).toBe(false);
});
