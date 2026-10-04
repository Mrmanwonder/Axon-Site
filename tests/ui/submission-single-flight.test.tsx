import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  ingest: vi.fn(),
  listDrafts: vi.fn(),
  readDraft: vi.fn(),
  deleteDraft: vi.fn(),
  finishDraftReview: vi.fn(),
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
  deleteDraft: fixture.deleteDraft,
  listDrafts: fixture.listDrafts,
  movePage: vi.fn(),
  readDraft: fixture.readDraft,
  removePage: vi.fn(),
}));
vi.mock("../../src/scan/upload-policy.js", () => ({ preloadUploadPolicy: vi.fn() }));
vi.mock("../../src/scan/original-backups.js", () => ({
  cancelOriginalBackups: vi.fn(), resumeStudentBackups: vi.fn().mockResolvedValue([]),
  resumeOriginalBackups: vi.fn().mockResolvedValue(undefined), finishDraftReview: fixture.finishDraftReview,
}));
vi.mock("../../src/scan/review.js", () => ({
  commitRun: fixture.commitRun, confirmQuestion: vi.fn(), confirmQuestions: vi.fn(),
  correctAnswer: vi.fn(), correctMark: vi.fn(), loadReview: fixture.loadReview, rejectCause: vi.fn(),
}));
vi.mock("../../src/scan/crops.js", () => ({ releaseCrops: fixture.releaseCrops }));
vi.mock("../../src/scan/enhance.js", () => ({ RESCUED_NOTICE: "rescued" }));
vi.mock("../../src/papers.js", () => ({
  PAPER_TYPES: [{ label: "Class test", value: "unit_test" }],
  paperTypesFor: () => [{ label: "Class test", value: "unit_test" }],
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

test("canonical paper review does not wait for hanging IndexedDB reads", async () => {
  const pendingDrafts = deferred<any[]>();
  const pendingExactDraft = deferred<any>();
  fixture.listDrafts.mockReturnValue(pendingDrafts.promise);
  fixture.readDraft.mockReturnValue(pendingExactDraft.promise);
  fixture.currentRunForPaper.mockResolvedValue({ id: "run", status: "needs_review" });
  fixture.regionsForRun.mockResolvedValue([{ id: "q1", order_index: 0, question_label: "1" }]);
  fixture.loadReview.mockResolvedValue({
    paper: { id: "paper", type: "unit_test" },
    outstanding: 1,
    cleanUnconfirmed: [],
    questions: [],
  });

  const renderReview = vi.fn();
  const open = vi.fn();
  initScanUI({ student: { id: "student" } }, { renderReview, openReview: open });

  const reopening = resumeDraftReview("paper");

  await waitFor(() => expect(fixture.currentRunForPaper).toHaveBeenCalledWith("paper"));
  await expect(reopening).resolves.toEqual({ state: "reviewing" });
  expect(fixture.readDraft).not.toHaveBeenCalledWith("paper");
  expect(fixture.regionsForRun).toHaveBeenCalledWith("run");
  expect(fixture.loadReview).toHaveBeenCalledWith("run");
  expect(open).toHaveBeenCalledWith("paper", null);

  pendingDrafts.resolve([]);
  pendingExactDraft.resolve(null);
});

test("legacy draft-id review falls back to the local paper id only after server miss", async () => {
  fixture.listDrafts.mockResolvedValue([]);
  fixture.readDraft.mockResolvedValue({
    id: "legacy-draft",
    student_id: "student",
    paper_id: "paper",
    pages: [],
  });
  fixture.currentRunForPaper
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ id: "run", status: "needs_review" });
  fixture.regionsForRun.mockResolvedValue([{ id: "q1", order_index: 0, question_label: "1" }]);
  fixture.loadReview.mockResolvedValue({
    paper: { id: "paper", type: "unit_test" },
    outstanding: 1,
    cleanUnconfirmed: [],
    questions: [],
  });

  const open = vi.fn();
  initScanUI({ student: { id: "student" } }, { renderReview: vi.fn(), openReview: open });

  await expect(resumeDraftReview("legacy-draft")).resolves.toEqual({ state: "reviewing" });
  expect(fixture.currentRunForPaper.mock.calls.map(([id]) => id)).toEqual(["legacy-draft", "paper"]);
  expect(fixture.readDraft).toHaveBeenCalledWith("legacy-draft");
  expect(open).toHaveBeenCalledWith("paper", null);
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

test("saving a server review without a local draft preserves another unfinished capture", async () => {
  const draftA = { id: "draft-a", paper_id: "paper-a", student_id: "student", pages: [] };
  fixture.listDrafts.mockResolvedValue([draftA]);
  fixture.readDraft.mockResolvedValue(draftA);
  fixture.currentRunForPaper.mockResolvedValue({ id: "run-b", status: "needs_review" });
  fixture.regionsForRun.mockResolvedValue([]);
  fixture.loadReview.mockResolvedValue({ paper: { id: "paper-b", type: "unit_test" }, outstanding: 0, cleanUnconfirmed: [], questions: [] });
  fixture.commitRun.mockResolvedValue({ attempts_committed: 1 });
  fixture.startExplanations.mockResolvedValue(undefined);
  fixture.watchExplanations.mockResolvedValue(undefined);
  let resume!: (id: string) => Promise<void>;
  let save!: () => Promise<void>;
  const renderTray = vi.fn();
  initScanUI({ student: { id: "student" } }, {
    draftToast: (_draft: unknown, handlers: any) => { resume = handlers.onResume; },
    renderTray, renderDrafts: vi.fn(),
    renderReview: (_model: unknown, handlers: any) => { save = handlers.onSave; },
  });
  await waitFor(() => expect(resume).toBeDefined());
  await resume("draft-a");
  await resumeDraftReview("paper-b");
  await save();
  expect(fixture.deleteDraft).not.toHaveBeenCalled();
});

test("a delayed draft lookup cannot replace the next review's matching draft", async () => {
  const pending = deferred<any[]>();
  fixture.listDrafts.mockResolvedValue([]);
  fixture.currentRunForPaper.mockImplementation(async paper => ({ id: `run-${paper}`, status: "needs_review" }));
  fixture.regionsForRun.mockResolvedValue([]);
  fixture.loadReview.mockImplementation(async run => ({ paper: { id: run.slice(4), type: "unit_test" }, outstanding: 0, cleanUnconfirmed: [], questions: [] }));
  fixture.commitRun.mockResolvedValue({ attempts_committed: 1 });
  fixture.startExplanations.mockResolvedValue(undefined);
  fixture.watchExplanations.mockResolvedValue(undefined);
  let save!: () => Promise<void>;
  initScanUI({ student: { id: "student" } }, { renderReview: (_m: unknown, h: any) => { save = h.onSave; } });
  await Promise.resolve();
  fixture.listDrafts.mockReturnValueOnce(pending.promise);
  await resumeDraftReview("paper-a");
  const draftB = { id: "draft-b", paper_id: "paper-b", student_id: "student", pages: [] };
  fixture.listDrafts.mockResolvedValue([draftB]);
  await resumeDraftReview("paper-b");
  pending.resolve([{ id: "draft-a", paper_id: "paper-a", student_id: "student", pages: [] }]);
  await Promise.resolve();
  await save();
  expect(fixture.finishDraftReview).toHaveBeenCalledWith(expect.objectContaining({ id: "draft-b" }));
  expect(fixture.finishDraftReview).not.toHaveBeenCalledWith(expect.objectContaining({ id: "draft-a" }));
});
