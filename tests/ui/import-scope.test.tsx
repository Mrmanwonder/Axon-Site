import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  ingest: vi.fn(),
  acceptPage: vi.fn(),
  createDraft: vi.fn(),
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
  acceptPage: fixture.acceptPage,
  currentRunForPaper: fixture.currentRunForPaper,
  ingest: fixture.ingest,
  regionsForRun: fixture.regionsForRun,
  startExplanations: fixture.startExplanations,
  watchExplanations: fixture.watchExplanations,
}));
vi.mock("../../src/scan/drafts.js", () => ({
  createDraft: fixture.createDraft,
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

import { initScanUI, resetScan, setScanContext, acceptUploads } from "../../src/scan/ui.js";

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


afterEach(() => { resetScan(); vi.unstubAllGlobals(); });
const files = () => [new File(["one"], "one.png", { type: "image/png" }), new File(["two"], "two.jpg", { type: "image/jpeg" })];
const bitmap = () => ({ width: 0, height: 0, close: vi.fn() });

beforeEach(() => {
  fixture.listDrafts.mockResolvedValue([]);
  fixture.createDraft.mockImplementation(async ({ studentId }) => ({ id: "draft", student_id: studentId, pages: [] }));
  fixture.acceptPage.mockImplementation(async ({ draft }) => {
    const page = { page_number: draft.pages.length + 1, blob: new Blob(["page"]), quality: { verdict: "ok" } };
    draft.pages.push(page);
    return { page };
  });
  setScanContext({ student: { id: "student-a" } });
});

test.each(["switch", "sign-out", "away-and-back", "reset"])("decoded uploads cannot cross a %s boundary", async mode => {
  const pending = deferred<any>();
  const decoded = bitmap();
  const decode = vi.fn().mockReturnValueOnce(pending.promise);
  vi.stubGlobal("createImageBitmap", decode);
  const importing = acceptUploads(files());
  if (mode === "switch") setScanContext({ student: { id: "student-b" } });
  else if (mode === "sign-out") setScanContext({ student: null });
  else if (mode === "away-and-back") {
    setScanContext({ student: { id: "student-b" } });
    setScanContext({ student: { id: "student-a" } });
  } else {
    resetScan();
    setScanContext({ student: { id: "student-a" } });
  }
  pending.resolve(decoded);
  const result = await importing;
  expect(result.accepted).toEqual([]);
  expect(result.rejected).toHaveLength(2);
  expect(result.rejected.every(row => row.reason.includes("profile changed"))).toBe(true);
  expect(decode).toHaveBeenCalledOnce();
  expect(decoded.close).toHaveBeenCalledOnce();
  expect(fixture.createDraft).not.toHaveBeenCalled();
  expect(fixture.acceptPage).not.toHaveBeenCalled();
});

test("a same-student context refresh preserves the import and closes each bitmap", async () => {
  const pending = deferred<any>();
  const first = bitmap(), second = bitmap();
  vi.stubGlobal("createImageBitmap", vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(second));
  const importing = acceptUploads(files());
  setScanContext({ student: { id: "student-a", name: "Updated name" } });
  pending.resolve(first);
  const result = await importing;
  expect(result.accepted).toEqual([{ name: "one.png" }, { name: "two.jpg" }]);
  expect(result.rejected).toEqual([]);
  expect(fixture.createDraft).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-a" }));
  expect(fixture.acceptPage).toHaveBeenCalledTimes(2);
  expect(first.close).toHaveBeenCalledOnce();
  expect(second.close).toHaveBeenCalledOnce();
});

test("missing student refuses before decoding", async () => {
  setScanContext({ student: null });
  const decode = vi.fn();
  vi.stubGlobal("createImageBitmap", decode);
  const result = await acceptUploads(files());
  expect(result.rejected.every(row => row.reason.includes("Choose a student"))).toBe(true);
  expect(decode).not.toHaveBeenCalled();
});
