import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  ingest: vi.fn(),
  listDrafts: vi.fn(),
  readDraft: vi.fn(),
  releaseCrops: vi.fn(),
  loadReview: vi.fn(),
  commitRun: vi.fn(),
  startExplanations: vi.fn(),
  watchExplanations: vi.fn(),
  currentRunForPaper: vi.fn(),
  regionsForRun: vi.fn(),
}));

vi.mock("../../src/scan/capture.js", () => ({
  createCapture: () => ({ start: vi.fn(), stop: vi.fn(), shoot: vi.fn(), setAuto: vi.fn(), state: {} }),
}));
vi.mock("../../src/scan/pipeline.js", () => ({
  acceptPage: vi.fn(),
  currentRunForPaper: fixture.currentRunForPaper,
  ingest: fixture.ingest,
  regionsForRun: fixture.regionsForRun,
  startExplanations: fixture.startExplanations,
  watchExplanations: fixture.watchExplanations,
}));
vi.mock("../../src/scan/drafts.js", () => ({
  createDraft: vi.fn(),
  deleteDraft: vi.fn(),
  listDrafts: fixture.listDrafts,
  movePage: vi.fn(),
  readDraft: fixture.readDraft,
  removePage: vi.fn(),
}));
vi.mock("../../src/scan/review.js", () => ({
  commitRun: fixture.commitRun, confirmQuestion: vi.fn(), confirmQuestions: vi.fn(),
  correctAnswer: vi.fn(), correctMark: vi.fn(), loadReview: fixture.loadReview, rejectCause: vi.fn(),
}));
vi.mock("../../src/scan/crops.js", () => ({ releaseCrops: fixture.releaseCrops }));
vi.mock("../../src/scan/enhance.js", () => ({ RESCUED_NOTICE: "rescued" }));
vi.mock("../../src/papers.js", () => ({
  PAPER_TYPES: [{ label: "Class test", value: "unit_test" }],
  tierForType: () => "tier_1",
}));

import { initScanUI, resetScan, openReview, resumeDraftReview } from "../../src/scan/ui.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetScan();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

async function reviewFixture() {
  fixture.listDrafts.mockResolvedValue([]);
  fixture.loadReview.mockReset().mockResolvedValue({
    paper: { id: "paper", type: "unit_test" },
    outstanding: 0, cleanUnconfirmed: [], questions: [],
  });
  fixture.commitRun.mockReset().mockResolvedValue({ attempts_committed: 1 });
  fixture.startExplanations.mockReset().mockResolvedValue(undefined);
  fixture.watchExplanations.mockReset().mockResolvedValue(undefined);
  let save!: () => Promise<void>;
  const renderReview = vi.fn((_model, handlers) => { save = handlers.onSave; });
  const closeReview = vi.fn();
  const toast = vi.fn();
  await initScanUI({ student: { id: "student" } }, { renderReview, closeReview, toast });
  await openReview("run");
  return { save, renderReview, closeReview, toast };
}

test("failed Save and failed refresh restore the action and allow a successful retry", async () => {
  const { save, renderReview, closeReview } = await reviewFixture();
  fixture.commitRun.mockRejectedValueOnce(new Error("Save unavailable"));
  fixture.loadReview.mockResolvedValueOnce({
    paper: { id: "paper", type: "unit_test" }, outstanding: 0, cleanUnconfirmed: [], questions: [],
  }).mockRejectedValueOnce(new Error("Refresh unavailable"));
  await save();
  expect(renderReview).toHaveBeenLastCalledWith(expect.objectContaining({ saving: false, saveLabel: "Save to Library" }), expect.anything());
  expect(closeReview).not.toHaveBeenCalled();
  await save();
  expect(fixture.commitRun).toHaveBeenCalledTimes(2);
  expect(closeReview).toHaveBeenCalledWith("paper");
});

test("initial Save refresh failure resets busy and does not commit", async () => {
  const { save, renderReview } = await reviewFixture();
  fixture.loadReview.mockRejectedValueOnce(new Error("Refresh unavailable"));
  await save();
  expect(fixture.commitRun).not.toHaveBeenCalled();
  expect(renderReview).toHaveBeenLastCalledWith(expect.objectContaining({ saving: false }), expect.anything());
  await save();
  expect(fixture.commitRun).toHaveBeenCalledTimes(1);
});

test("leaving a student context during explanations cannot commit or navigate the next student", async () => {
  const { save, closeReview } = await reviewFixture();
  const pending = deferred<void>();
  fixture.watchExplanations.mockReturnValueOnce(pending.promise);
  const saving = save();
  await waitFor(() => expect(fixture.watchExplanations).toHaveBeenCalledTimes(1));
  resetScan();
  pending.resolve();
  await saving;
  expect(fixture.commitRun).not.toHaveBeenCalled();
  expect(closeReview).not.toHaveBeenCalled();
});

test("review re-entry cannot restore a previous student's work after switching profiles", async () => {
  await reviewFixture();
  fixture.readDraft.mockResolvedValue(null);
  fixture.currentRunForPaper.mockResolvedValue({ id: "old-run", status: "needs_review" });
  const pending = deferred<unknown[]>();
  fixture.regionsForRun.mockReturnValueOnce(pending.promise);
  const reopening = resumeDraftReview("old-paper");
  await waitFor(() => expect(fixture.regionsForRun).toHaveBeenCalledTimes(1));
  resetScan();
  const nextRender = vi.fn();
  const nextOpen = vi.fn();
  await initScanUI({ student: { id: "next-student" } }, { renderReview: nextRender, openReview: nextOpen });
  pending.resolve([]);
  expect(await reopening).toEqual({ state: "gone" });
  expect(nextRender).not.toHaveBeenCalled();
  expect(nextOpen).not.toHaveBeenCalled();
});

test("ten rapid Read actions submit once and a recoverable rejection permits retry", async () => {
  const draft = {
    id: "draft",
    student_id: "student",
    paper_type: "unit_test",
    pages: [{ page_number: 1, blob: new Blob(["page"]) }],
  };
  fixture.listDrafts.mockResolvedValue([draft]);
  fixture.readDraft.mockResolvedValue(draft);
  const first = deferred<{ refused: true; message: string }>();
  fixture.ingest
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ refused: true, message: "Retake the cover page." });

  let resume!: (id: string) => Promise<void>;
  let read!: () => Promise<void>;
  const submissionBusy = vi.fn();
  const renderProgress = vi.fn();
  await initScanUI({ student: { id: "student" }, guardian: { id: "guardian" } }, {
    draftToast: (_draft: unknown, handlers: { onResume: (id: string) => Promise<void> }) => { resume = handlers.onResume; },
    renderDrafts: vi.fn(),
    renderTray: (_pages: unknown[], handlers: { onDone: () => Promise<void> }) => { read = handlers.onDone; },
    renderProgress,
    submissionBusy,
    navigationIntent: () => "scan-route",
  });
  await resume("draft");

  for (let tap = 0; tap < 10; tap += 1) void read();
  expect(fixture.ingest).toHaveBeenCalledTimes(1);
  expect(submissionBusy).toHaveBeenCalledWith(true);

  await act(async () => first.resolve({ refused: true, message: "Retake the cover page." }));
  await waitFor(() => expect(submissionBusy).toHaveBeenLastCalledWith(false));
  expect(renderProgress).toHaveBeenLastCalledWith(expect.objectContaining({ heading: "This one we did not read" }));

  await read();
  expect(fixture.ingest).toHaveBeenCalledTimes(2);
});
