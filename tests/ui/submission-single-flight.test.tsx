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
  storePlacedLabels: vi.fn(),
  confirmQuestions: vi.fn(),
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
  requestSend: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/scan/upload-policy.js", () => ({ preloadUploadPolicy: vi.fn() }));
vi.mock("../../src/scan/original-backups.js", () => ({
  cancelOriginalBackups: vi.fn(), resumeStudentBackups: vi.fn().mockResolvedValue([]),
  resumeOriginalBackups: vi.fn().mockResolvedValue(undefined), finishDraftReview: fixture.finishDraftReview,
}));
vi.mock("../../src/scan/review.js", () => ({
  commitRun: fixture.commitRun, confirmQuestion: vi.fn(), confirmQuestions: fixture.confirmQuestions,
  correctAnswer: vi.fn(), correctMark: vi.fn(), loadReview: fixture.loadReview, rejectCause: vi.fn(), relabelRegion: vi.fn(),
  storePlacedLabels: fixture.storePlacedLabels,
  saveFailureMessage: (error: Error) => `Your paper did not finish saving. ${error.message}`,
  isSaveRefusal: (error: { code?: string }) => error?.code === "42501",
}));
vi.mock("../../src/scan/crops.js", () => ({ releaseCrops: fixture.releaseCrops }));
vi.mock("../../src/scan/enhance.js", () => ({ RESCUED_NOTICE: "rescued" }));
vi.mock("../../src/papers.js", () => ({
  PAPER_TYPES: [{ label: "Class test", value: "unit_test" }],
  paperTypesFor: () => [{ label: "Class test", value: "unit_test" }],
  tierForType: () => "tier_1",
  fixSavedPart: vi.fn(),
  relabelAttempt: vi.fn(),
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

test("Save closes review at once and commits in the background", async () => {
  const { save, closeReview, toast } = await reviewFixture();
  const commit = deferred<{ attempts_committed: number }>();
  fixture.commitRun.mockReturnValueOnce(commit.promise);
  await save();
  // Instant feedback (owner, 6 Oct 2026): closed before anything has committed.
  expect(closeReview).toHaveBeenCalledWith("paper");
  expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^Paper saved/), undefined);
  await waitFor(() => expect(fixture.commitRun).toHaveBeenCalledTimes(1));
  commit.resolve({ attempts_committed: 1 });
});

test("a commit that keeps failing is retried, then the student is told the paper waits in the Library", async () => {
  const { save, toast } = await reviewFixture();
  fixture.commitRun.mockReset().mockRejectedValue(new Error("Save unavailable"));
  vi.useFakeTimers();
  try {
    await save();
    await vi.runAllTimersAsync();
  } finally { vi.useRealTimers(); }
  expect(fixture.commitRun).toHaveBeenCalledTimes(4);
  expect(toast).toHaveBeenLastCalledWith(expect.stringMatching(/did not finish saving/), "warn");
});

test("Save confirms nothing on the student's behalf; unchecked flagged parts save as unsure (AXO-216)", async () => {
  const { save, closeReview } = await reviewFixture();
  fixture.loadReview.mockResolvedValue({
    paper: { id: "paper", type: "unit_test" }, outstanding: 2, cleanUnconfirmed: [],
    questions: [{ id: "q1", tier: "confident", confirmed: false, flagged: true }, { id: "q2", tier: "unreadable", confirmed: false, flagged: true }],
  });
  await openReview("run");
  await save();
  expect(closeReview).toHaveBeenCalledWith("paper");
  await waitFor(() => expect(fixture.commitRun).toHaveBeenCalledWith("run"));
  expect(fixture.confirmQuestions).not.toHaveBeenCalled();
  expect(fixture.storePlacedLabels).toHaveBeenCalledWith("run");
});

test("a refused save is not retried, and the student sees the database's own reason", async () => {
  const { save, toast } = await reviewFixture();
  fixture.commitRun.mockReset().mockRejectedValue(Object.assign(
    new Error("Two parts of this paper are both read as 3(c), so Axon cannot tell which mark belongs to which. Choose Check the reading and change the label on one of them."),
    { code: "42501" },
  ));
  await save();
  await waitFor(() => expect(toast).toHaveBeenLastCalledWith(expect.stringMatching(/both read as 3\(c\)/), "warn"));
  expect(fixture.commitRun).toHaveBeenCalledTimes(1);
  // Opening the paper again shows the reason instead of saving into the same refusal.
  fixture.currentRunForPaper.mockResolvedValue({ id: "run", status: "ready" });
  await expect(resumeDraftReview("paper")).resolves.toEqual(expect.objectContaining({ state: "save_failed", paperId: "paper" }));
});

test("opening a read paper saves it on its own instead of opening review", async () => {
  fixture.listDrafts.mockResolvedValue([]);
  fixture.currentRunForPaper.mockResolvedValue({ id: "run", status: "needs_review" });
  fixture.regionsForRun.mockResolvedValue([{ id: "q1", order_index: 0, question_label: "1" }]);
  fixture.commitRun.mockReset().mockResolvedValue({ attempts_committed: 1 });
  fixture.startExplanations.mockReset().mockRejectedValue(new Error("1 question still needs your eyes."));
  fixture.watchExplanations.mockReset().mockResolvedValue(undefined);
  const open = vi.fn();
  const renderReview = vi.fn();
  await initScanUI({ student: { id: "student" } }, { renderReview, openReview: open, refreshLibrary: vi.fn() });
  await expect(resumeDraftReview("paper")).resolves.toEqual({ state: "saving", paperId: "paper" });
  await waitFor(() => expect(fixture.commitRun).toHaveBeenCalledWith("run"));
  expect(fixture.storePlacedLabels).toHaveBeenCalledWith("run");
  // Explanations that never started are not waited for.
  expect(fixture.watchExplanations).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  expect(renderReview).not.toHaveBeenCalled();
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
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fixture.commitRun).not.toHaveBeenCalled();
  // Closed once, at Save, for the student who saved; never for the next one.
  expect(closeReview).toHaveBeenCalledTimes(1);
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

  const reopening = resumeDraftReview("paper", { check: true });

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

  await expect(resumeDraftReview("legacy-draft", { check: true })).resolves.toEqual({ state: "reviewing" });
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
  const reopening = resumeDraftReview("old-paper", { check: true });
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

test("ten rapid Read actions hand the paper over once, and the scanner is free for the next paper", async () => {
  const draft = {
    id: "draft",
    student_id: "student",
    paper_type: "unit_test",
    pages: [{ page_number: 1, blob: new Blob(["page"]) }],
  };
  fixture.listDrafts.mockResolvedValue([draft]);
  fixture.readDraft.mockResolvedValue(draft);
  const first = deferred<{ refused: true; message: string }>();
  fixture.ingest.mockReturnValueOnce(first.promise);

  let resume!: (id: string) => Promise<void>;
  let read!: () => Promise<void>;
  const submissionBusy = vi.fn();
  const sendStarted = vi.fn();
  const renderTray = vi.fn((_pages: unknown[], handlers: { onDone: () => Promise<void> }) => { read = handlers.onDone; });
  const toast = vi.fn();
  await initScanUI({ student: { id: "student" }, guardian: { id: "guardian" } }, {
    draftToast: (_draft: unknown, handlers: { onResume: (id: string) => Promise<void> }) => { resume = handlers.onResume; },
    renderDrafts: vi.fn(), renderTray, submissionBusy, sendStarted, toast,
    navigationIntent: () => "scan-route",
  });
  await resume("draft");

  for (let tap = 0; tap < 10; tap += 1) void read();
  await waitFor(() => expect(sendStarted).toHaveBeenCalledWith("draft"));
  await waitFor(() => expect(fixture.ingest).toHaveBeenCalledTimes(1));
  expect(submissionBusy).toHaveBeenCalledWith(true);
  await waitFor(() => expect(submissionBusy).toHaveBeenLastCalledWith(false));
  // The scanner holds a fresh, empty paper while this one sends.
  expect(renderTray).toHaveBeenLastCalledWith([], expect.anything());
  await act(async () => first.resolve({ refused: true, message: "Retake the cover page." }));
  await read();
  expect(fixture.ingest).toHaveBeenCalledTimes(1);
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
  await resumeDraftReview("paper-b", { check: true });
  await save();
  await waitFor(() => expect(fixture.commitRun).toHaveBeenCalled());
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
  await resumeDraftReview("paper-a", { check: true });
  const draftB = { id: "draft-b", paper_id: "paper-b", student_id: "student", pages: [] };
  fixture.listDrafts.mockResolvedValue([draftB]);
  await resumeDraftReview("paper-b", { check: true });
  pending.resolve([{ id: "draft-a", paper_id: "paper-a", student_id: "student", pages: [] }]);
  await Promise.resolve();
  await save();
  await waitFor(() => expect(fixture.finishDraftReview).toHaveBeenCalled());
  expect(fixture.finishDraftReview).toHaveBeenCalledWith(expect.objectContaining({ id: "draft-b" }));
  expect(fixture.finishDraftReview).not.toHaveBeenCalledWith(expect.objectContaining({ id: "draft-a" }));
});
