import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  app: { student: { id: "a" }, guardian: { id: "g" }, takePendingPaperType: vi.fn(), refreshLibrary: vi.fn() },
  ensureScan: vi.fn(), acceptUploads: vi.fn(), setPendingPaperType: vi.fn(), toast: vi.fn(), navigate: vi.fn(),
}));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => fixture.app }));
vi.mock("../../src/ui/scan/ScanProvider", () => ({ useScan: () => ({ ensureScan: fixture.ensureScan }) }));
vi.mock("../../src/ui/components/ToastProvider", () => ({ useToast: () => fixture.toast }));
vi.mock("../../src/ui/components/SheetProvider", () => ({ useSheetControls: () => ({ openSheet: vi.fn() }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => fixture.navigate }));
vi.mock("../../src/ui/data/modules", () => ({ sb: { rpc: vi.fn() }, parsePaperLink: vi.fn() }));
import { IngestionProvider, useIngestion } from "../../src/ui/data/useIngestion";

let ingest!: (files: File[]) => Promise<void>;
function Consumer() { ingest = useIngestion().ingestFiles; return null; }
function App() { return <IngestionProvider><Consumer /></IngestionProvider>; }
const file = () => [new File(["page"], "page.png", { type: "image/png" })];
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const scan = () => ({ acceptUploads: fixture.acceptUploads, setPendingPaperType: fixture.setPendingPaperType });
beforeEach(() => {
  vi.clearAllMocks();
  fixture.app.student = { id: "a" };
  fixture.app.guardian = { id: "g" };
  fixture.app.takePendingPaperType.mockReturnValue("unit_test");
  fixture.ensureScan.mockResolvedValue(scan());
  fixture.acceptUploads.mockResolvedValue({ accepted: [{ name: "page.png" }], rejected: [] });
  Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
});
afterEach(() => { Reflect.deleteProperty(navigator, "connection"); });

test.each(["student", "guardian", "away-and-back", "unmount"])("pending module load cannot import after %s changes", async change => {
  const pending = deferred<any>();
  fixture.ensureScan.mockReturnValue(pending.promise);
  const view = render(<App />);
  const importing = ingest(file());
  if (change === "unmount") view.unmount();
  else {
    if (change === "guardian") fixture.app.guardian = { id: "new-g" };
    else fixture.app.student = { id: "b" };
    view.rerender(<App />);
    if (change === "away-and-back") { fixture.app.student = { id: "a" }; view.rerender(<App />); }
  }
  await act(async () => { pending.resolve(scan()); await importing; });
  expect(fixture.acceptUploads).not.toHaveBeenCalled();
  expect(fixture.app.takePendingPaperType).not.toHaveBeenCalled();
  expect(fixture.navigate).not.toHaveBeenCalled();
  expect(fixture.toast).not.toHaveBeenCalled();
});

test("completion of a previous profile's import cannot navigate or toast in the next profile", async () => {
  const pending = deferred<any>();
  fixture.acceptUploads.mockReturnValue(pending.promise);
  const view = render(<App />);
  const importing = ingest(file());
  await act(async () => { await Promise.resolve(); });
  expect(fixture.acceptUploads).toHaveBeenCalledOnce();
  fixture.app.student = { id: "b" };
  view.rerender(<App />);
  await act(async () => { pending.resolve({ accepted: [{ name: "page.png" }], rejected: [] }); await importing; });
  expect(fixture.navigate).not.toHaveBeenCalled();
  expect(fixture.toast).not.toHaveBeenCalled();
});

test("same-profile completion still consumes the pending type, imports, and opens Scan", async () => {
  render(<App />);
  await act(async () => { await ingest(file()); });
  expect(fixture.setPendingPaperType).toHaveBeenCalledWith("unit_test");
  expect(fixture.acceptUploads).toHaveBeenCalledOnce();
  expect(fixture.navigate).toHaveBeenCalledWith("/scan");
  expect(fixture.toast).toHaveBeenCalledWith(expect.stringContaining("1 page(s) added."));
});

test("module initialization failure is visible without an unhandled rejection", async () => {
  fixture.ensureScan.mockRejectedValue(new Error("load failed"));
  render(<App />);
  await act(async () => { await ingest(file()); });
  expect(fixture.toast).toHaveBeenCalledWith(expect.stringContaining("Try selecting them again"), "warn");
  expect(fixture.acceptUploads).not.toHaveBeenCalled();
});
