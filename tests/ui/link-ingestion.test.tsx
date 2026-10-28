import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// AXO-295: a pasted link is fetched on the server and imported like a chosen file.
const fixture = vi.hoisted(() => ({
  app: { student: { id: "a" } as { id: string } | null, guardian: { id: "g" }, takePendingPaperType: vi.fn(), refreshLibrary: vi.fn() },
  ensureScan: vi.fn(), acceptUploads: vi.fn(), setPendingPaperType: vi.fn(), toast: vi.fn(), navigate: vi.fn(),
  openSheet: vi.fn(), fetchLink: vi.fn(), rpc: vi.fn(),
}));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ ...fixture.app }) }));
vi.mock("../../src/ui/scan/ScanProvider", () => ({ useScan: () => ({ ensureScan: fixture.ensureScan }) }));
vi.mock("../../src/ui/components/ToastProvider", () => ({ useToast: () => fixture.toast }));
vi.mock("../../src/ui/components/SheetProvider", () => ({ useSheetControls: () => ({ openSheet: fixture.openSheet }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => fixture.navigate }));
vi.mock("../../src/ui/data/modules", () => ({ sb: { rpc: fixture.rpc }, parsePaperLink: (raw: string) => raw.trim() }));
vi.mock("../../src/scan/functions.js", () => ({ fetchLink: fixture.fetchLink }));
import { IngestionProvider, useIngestion } from "../../src/ui/data/useIngestion";

let addLink!: () => void;
function Consumer() { addLink = useIngestion().addLink; return null; }
const App = () => <IngestionProvider><Consumer /></IngestionProvider>;

async function pasteLink(raw: string) {
  addLink();
  const sheet = fixture.openSheet.mock.calls.at(-1)![0];
  await act(async () => { await sheet.onConfirm(raw); });
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.app.student = { id: "a" };
  fixture.app.takePendingPaperType.mockReturnValue(null);
  fixture.ensureScan.mockResolvedValue({ acceptUploads: fixture.acceptUploads, setPendingPaperType: fixture.setPendingPaperType });
  fixture.acceptUploads.mockResolvedValue({ accepted: [{ name: "Paper 1.pdf · page 1" }], rejected: [] });
  Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
});
afterEach(() => { Reflect.deleteProperty(navigator, "connection"); });

test("a fetched link is imported through the same path as a chosen file, and no placeholder paper is made", async () => {
  const pdf = new File(["%PDF-1.7"], "Paper 1.pdf", { type: "application/pdf" });
  fixture.fetchLink.mockResolvedValue(pdf);
  render(<App />);
  await pasteLink("https://school.org/Paper%201.pdf");
  expect(fixture.fetchLink).toHaveBeenCalledWith("https://school.org/Paper%201.pdf");
  expect(fixture.acceptUploads).toHaveBeenCalledWith([pdf]);
  expect(fixture.navigate).toHaveBeenCalledWith("/scan");
  expect(fixture.rpc).not.toHaveBeenCalled();
});

test("a link the server refuses shows its reason and adds nothing", async () => {
  fixture.fetchLink.mockRejectedValue(new Error("That link needs a sign-in. Open it, download the file, and add it from your files."));
  render(<App />);
  await pasteLink("https://drive.google.com/file/d/abcdefghijkl/view");
  expect(fixture.toast).toHaveBeenLastCalledWith(expect.stringMatching(/needs a sign-in/), "warn");
  expect(fixture.acceptUploads).not.toHaveBeenCalled();
  expect(fixture.rpc).not.toHaveBeenCalled();
});

test("an empty paste never reaches the server", async () => {
  render(<App />);
  await pasteLink("   ");
  expect(fixture.fetchLink).not.toHaveBeenCalled();
});

test("without a student profile nothing is fetched", async () => {
  fixture.app.student = null;
  render(<App />);
  await pasteLink("https://school.org/p.pdf");
  expect(fixture.fetchLink).not.toHaveBeenCalled();
  expect(fixture.toast).toHaveBeenCalledWith("Create a student profile first.", "warn");
});
