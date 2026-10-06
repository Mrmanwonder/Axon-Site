import { expect, test, vi } from "vitest";
import { createSendQueue } from "../../src/scan/send-queue.js";

type Job = { id: string; phase: string; message: string; paperId: string | null; pages: { n: number; sent: boolean }[] };

function draft(id: string, extra: Record<string, unknown> = {}) {
  return { id, student_id: "s", paper_id: null as string | null, paper_type: "unit_test", pages: [{ page_number: 1 }, { page_number: 2 }], ...extra };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function queueWith(over: Record<string, unknown> = {}) {
  const phases: string[] = [];
  const deps = {
    ingest: vi.fn(),
    currentRunForPaper: vi.fn(),
    readDraft: vi.fn(),
    listDrafts: vi.fn().mockResolvedValue([]),
    requestSend: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    online: () => true,
    ...over,
  };
  const queue = createSendQueue(deps as never);
  queue.subscribe((jobs: Job[]) => { for (const j of jobs) phases.push(j.phase); });
  return { queue, deps, phases };
}

test("a dropped connection waits and carries on; it never ends as a failure", async () => {
  const { queue, deps, phases } = queueWith({ online: () => false });
  deps.ingest
    .mockRejectedValueOnce(new Error("Could not reach the server. Check your connection and try again."))
    .mockRejectedValueOnce(new Error("Could not reach the server. Check your connection and try again."))
    .mockResolvedValueOnce({ paperId: "paper", runId: "run", refused: false, regions: [] });
  const done = await queue.start({ studentId: "s", draft: draft("d1"), paperType: "unit_test", title: "Class test" });
  expect(deps.requestSend).toHaveBeenCalledTimes(1);
  expect(deps.ingest).toHaveBeenCalledTimes(3);
  expect(phases).toContain("waiting");
  expect(done.phase).toBe("review");
  expect(queue.get("d1")?.message).not.toMatch(/did not finish/i);
});

test("another live tab sending the same paper is waited for, not reported as an error", async () => {
  const { queue, deps } = queueWith();
  const messages: string[] = [];
  queue.subscribe((jobs: Job[]) => { if (jobs[0]) messages.push(jobs[0].message); });
  deps.ingest
    .mockRejectedValueOnce(Object.assign(new Error("busy"), { busy: true }))
    .mockResolvedValueOnce({ paperId: "paper", runId: "run", refused: false, regions: [] });
  const done = await queue.start({ studentId: "s", draft: draft("d1"), paperType: "unit_test" });
  expect(messages.some((m) => /another Axon tab/.test(m))).toBe(true);
  expect(done.phase).toBe("review");
});

test("several papers send at the same time", async () => {
  const { queue, deps } = queueWith();
  const a = deferred<unknown>(), b = deferred<unknown>();
  deps.ingest.mockImplementation(({ draft: d }: { draft: { id: string } }) => (d.id === "a" ? a.promise : b.promise));
  void queue.start({ studentId: "s", draft: draft("a"), paperType: "unit_test" });
  void queue.start({ studentId: "s", draft: draft("b"), paperType: "unit_test" });
  await vi.waitFor(() => expect(deps.ingest).toHaveBeenCalledTimes(2));
  expect(queue.list().map((j: Job) => j.phase)).toEqual(["sending", "sending"]);
  a.resolve({ paperId: "pa", runId: "ra", refused: false, regions: [] });
  b.resolve({ paperId: "pb", runId: "rb", refused: false, regions: [] });
  await vi.waitFor(() => expect(queue.list().every((j: Job) => j.phase === "review")).toBe(true));
});

test("a send interrupted by a closed tab resumes on the next open; finished and unsent drafts are left alone", async () => {
  const { queue, deps } = queueWith();
  deps.listDrafts.mockResolvedValue([
    draft("asked", { send_requested: { at: 1 }, paper_id: "p1" }),
    draft("posting", { submission_started: { paper_id: "p2" }, paper_id: "p2" }),
    draft("sent", { send_requested: { at: 1 }, submission: { run_id: "r" } }),
    draft("still-a-draft"),
  ]);
  deps.ingest.mockResolvedValue({ paperId: "p", runId: "r", refused: false, regions: [] });
  await queue.resume("s");
  await vi.waitFor(() => expect(deps.ingest).toHaveBeenCalledTimes(2));
  expect(deps.ingest.mock.calls.map(([args]: [{ draft: { id: string } }]) => args.draft.id).sort()).toEqual(["asked", "posting"]);
  expect(deps.requestSend).not.toHaveBeenCalled();
});

test("progress is told in pages, and a page counts once its files are confirmed", async () => {
  const { queue, deps } = queueWith();
  const gate = deferred<unknown>();
  deps.ingest.mockImplementation(({ onProgress }: { onProgress: (p: unknown) => void }) => {
    onProgress({ stage: "upload", message: "1 of 2 pages safely sent", sentPages: [1] });
    return gate.promise;
  });
  void queue.start({ studentId: "s", draft: draft("d1"), paperType: "unit_test" });
  await vi.waitFor(() => expect(queue.get("d1")?.pages.map((p: { sent: boolean }) => p.sent)).toEqual([true, false]));
  gate.resolve({ paperId: "p", runId: "r", refused: false, regions: [] });
});

test("a paper the server keeps refusing waits for Try again instead of failing", async () => {
  const { queue, deps } = queueWith();
  const bad = Object.assign(new Error("bad request"), { status: 422 });
  deps.ingest.mockRejectedValueOnce(bad).mockRejectedValueOnce(bad).mockRejectedValueOnce(bad)
    .mockResolvedValueOnce({ paperId: "p", runId: "r", refused: false, regions: [] });
  const done = queue.start({ studentId: "s", draft: draft("d1"), paperType: "unit_test" });
  await vi.waitFor(() => expect(queue.get("d1")?.phase).toBe("stuck"));
  expect(queue.get("d1")?.message).toMatch(/pages are kept/);
  queue.wake("d1");
  expect((await done).phase).toBe("review");
});

test("a long read is watched until review, with its stage named", async () => {
  const { queue, deps } = queueWith();
  deps.ingest.mockResolvedValue({ paperId: "p", runId: "r", processing: true, status: "content" });
  deps.currentRunForPaper
    .mockResolvedValueOnce({ id: "r", status: "content" })
    .mockResolvedValueOnce({ id: "r", status: "needs_review" });
  const done = await queue.start({ studentId: "s", draft: draft("d1"), paperType: "unit_test" });
  expect(done.phase).toBe("review");
  expect(done.paperId).toBe("p");
});
