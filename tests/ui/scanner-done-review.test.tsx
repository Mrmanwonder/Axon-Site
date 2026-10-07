/* AXO-212. Done goes straight to reading when every page is fine; it becomes
   Review only when a page is flagged on evidence (Axon.md section 7). A
   "warn" quality verdict is a note, never a flag (D25). An imported page has
   no detection to doubt, and a page with no recorded checks is unknown, not
   failed (hard rule 4), so neither of those opens Review either. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ readDraft: vi.fn(), listDrafts: vi.fn() }));

vi.mock("../../src/scan/capture.js", () => ({
  createCapture: () => ({ start: vi.fn(), stop: vi.fn(), shoot: vi.fn(), setAutoCapture: vi.fn(), setProcessing: vi.fn(), state: {} }),
}));
vi.mock("../../src/scan/drafts.js", () => ({
  createDraft: vi.fn(),
  deleteDraft: vi.fn(),
  listDrafts: fixture.listDrafts,
  movePage: vi.fn(),
  readDraft: fixture.readDraft,
  removePage: vi.fn(),
  requestSend: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/scan/upload-policy.js", () => ({ preloadUploadPolicy: vi.fn() }));
vi.mock("../../src/scan/original-backups.js", () => ({
  cancelOriginalBackups: vi.fn(), resumeStudentBackups: vi.fn().mockResolvedValue([]),
  resumeOriginalBackups: vi.fn().mockResolvedValue(undefined), finishDraftReview: vi.fn(),
}));
vi.mock("../../src/papers.js", () => ({
  PAPER_TYPES: [{ label: "Class test", value: "unit_test" }],
  paperTypesFor: () => [{ label: "Class test", value: "unit_test" }],
  tierForType: () => "tier_1",
}));

import { flagFor, initScanUI, resetScan } from "../../src/scan/ui.js";
import { DoneButton, needsLook } from "../../src/ui/scan/PaperStack";
import type { TrayPage } from "../../src/ui/scan/ScanProvider";

const SOFT = "A little soft. Retake it if the teacher’s marking looks faint.";

const camera = (n: number, verdict: "ok" | "warn" | "fail", extra: Record<string, unknown> = {}) => ({
  page_number: n,
  blob: new Blob(["page"]),
  quality: { verdict, reasons: verdict === "ok" ? [] : [SOFT] },
  meta: { source_kind: "camera", geometry_confirmed: true },
  capture: { suggestedQuad: null, detection: { status: "found", source: "ml", score: 0.99, flagReason: null } },
  ...extra,
});
const imported = (n: number, verdict: "ok" | "warn") => ({
  page_number: n,
  blob: new Blob(["page"]),
  quality: { verdict, reasons: verdict === "ok" ? [] : [SOFT] },
  // conditioning.js: an upload never ran detection, so its geometry is not in doubt.
  meta: { source_kind: "upload", geometry_confirmed: true },
  source_kind: "upload",
});
// A page from before the checks were recorded: unknown, not failed.
const unchecked = (n: number) => ({ page_number: n, blob: new Blob(["page"]) });
const edgesUnconfirmed = (n: number) => camera(n, "ok", {
  meta: { source_kind: "camera", geometry_confirmed: false },
  capture: { suggestedQuad: null, detection: { status: "found", source: "ml", score: 0.6, flagReason: "uncertain" } },
});

beforeEach(() => {
  vi.clearAllMocks();
  resetScan();
  fixture.listDrafts.mockResolvedValue([]);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

test("a warn verdict, an imported page and a page with no recorded checks are not flags", () => {
  expect(flagFor(camera(1, "ok"))).toBeNull();
  expect(flagFor(camera(1, "warn"))).toBeNull();
  expect(flagFor(imported(1, "warn"))).toBeNull();
  expect(flagFor(unchecked(1))).toBeNull();
});

test("unconfirmed edges and a failed quality check are flags until the student keeps the page", () => {
  expect(flagFor(edgesUnconfirmed(1))?.kind).toBe("edges");
  expect(flagFor(camera(1, "fail"))?.kind).toBe("quality");
  expect(flagFor({ ...camera(1, "fail"), quality: { verdict: "fail", reasons: [SOFT], accepted: true } })).toBeNull();
  const kept = edgesUnconfirmed(1);
  expect(flagFor({ ...kept, meta: { ...kept.meta, geometry_accepted: true } })).toBeNull();
});

/** Load a draft into the scanner the way Saved drafts does, then press Done. */
async function pressDone(pages: unknown[]) {
  const host = {
    toast: vi.fn(), openSheet: vi.fn(), reviewPages: vi.fn(), renderDrafts: vi.fn(),
    draftToast: vi.fn(), sendStarted: vi.fn(), submissionBusy: vi.fn(), refreshLibrary: vi.fn(),
    renderTray: vi.fn(), firm: vi.fn(), tick: vi.fn(),
  };
  fixture.readDraft.mockResolvedValue({ id: "draft", student_id: "student", paper_type: null, pages });
  await initScanUI({ student: { id: "student" } }, host);
  await waitFor(() => expect(host.renderDrafts).toHaveBeenCalled());
  const [, draftHandlers] = host.renderDrafts.mock.calls.at(-1)!;
  await draftHandlers.onResume("draft");
  // Resuming opens the page grid on purpose (owner, 5 Oct 2026); only Done is under test.
  host.reviewPages.mockClear();
  const [rows, trayHandlers] = host.renderTray.mock.calls.at(-1);
  trayHandlers.onDone();
  return { host, rows: rows as TrayPage[] };
}

test("Done with every page fine, warn-only and imported pages included, goes on to reading", async () => {
  const { host, rows } = await pressDone([camera(1, "ok"), camera(2, "warn"), imported(3, "warn"), unchecked(4)]);
  expect(rows.filter(needsLook)).toHaveLength(0);
  expect(host.reviewPages).not.toHaveBeenCalled();
  // The next step toward reading: the paper's type, asked once, never Review.
  expect(host.openSheet).toHaveBeenCalledTimes(1);
  expect(host.openSheet.mock.calls[0][0].title).toBe("What kind of paper is this?");
});

test("Done with a flagged page opens Review instead of reading", async () => {
  for (const flagged of [edgesUnconfirmed(2), camera(2, "fail")]) {
    resetScan();
    const { host, rows } = await pressDone([camera(1, "warn"), flagged, imported(3, "ok")]);
    expect(rows.filter(needsLook).map((r) => r.page_number)).toEqual([2]);
    expect(host.reviewPages).toHaveBeenCalledTimes(1);
    expect(host.openSheet).not.toHaveBeenCalled();
  }
});

const row = (n: number, extra: Partial<TrayPage> = {}): TrayPage => ({ page_number: n, thumb: "blob:t", flag: null, ...extra });

test("the button says Done and reads when nothing is flagged, notes included", () => {
  const onDone = vi.fn(), onReview = vi.fn();
  render(<DoneButton pages={[row(1), row(2, { note: SOFT, quality: { verdict: "warn", reasons: [SOFT] } })]}
                     busy={false} onDone={onDone} onReview={onReview} />);
  const button = screen.getByRole("button", { name: "Done, read 2 pages" });
  fireEvent.click(button);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onReview).not.toHaveBeenCalled();
});

test("the button becomes Review only when a page is flagged", () => {
  const onDone = vi.fn(), onReview = vi.fn();
  render(<DoneButton pages={[row(1), row(2, { flag: { kind: "quality", reason: "Too blurred" } })]}
                     busy={false} onDone={onDone} onReview={onReview} />);
  fireEvent.click(screen.getByRole("button", { name: "Review 2 pages" }));
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
});

test("a page still being prepared holds Done rather than flagging it", () => {
  render(<DoneButton pages={[row(1), row(2, { pending: true })]} busy={false} onDone={vi.fn()} onReview={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Done, read 2 pages" });
  expect(button.textContent).toBe("Done");
  expect((button as HTMLButtonElement).disabled).toBe(true);
});
