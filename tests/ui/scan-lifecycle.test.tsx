import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { useEffect } from "react";
import { MemoryRouter, useNavigate, useLocation } from "react-router-dom";
import { ScanProvider, useScan } from "../../src/ui/scan/ScanProvider";

const fixture = vi.hoisted(() => ({ init: vi.fn(), attach: vi.fn(), detach: vi.fn(), visible: vi.fn(), camera: vi.fn(), release: vi.fn(), host: null as any, app: { student: { id: "s" }, guardian: { id: "g" }, refreshLibrary: vi.fn(), takePendingPaperType: () => null }, toast: vi.fn(), sheet: vi.fn() }));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ ...fixture.app }) }));
vi.mock("../../src/ui/components/ToastProvider", () => ({ useToast: () => fixture.toast }));
vi.mock("../../src/ui/components/SheetProvider", () => ({ useSheetControls: () => ({ openSheet: fixture.sheet }) }));
vi.mock("../../src/scan/camera.js", () => ({ cameraSupported: () => true, requestCamera: fixture.camera, releaseCamera: fixture.release }));
vi.mock("../../src/scan/ui.js", () => ({ initScanUI: fixture.init, attachSurface: fixture.attach, detachSurface: fixture.detach, setScanVisible: fixture.visible, resetScan: vi.fn(), setScanContext: vi.fn(), setPendingPaperType: vi.fn() }));
const deferred = () => { let resolve!: (value?: any) => void; const promise = new Promise<any>(yes => { resolve = yes; }); return { promise, resolve }; };
function Controls() {
  const scan = useScan(); const navigate = useNavigate(); const location = useLocation();
  useEffect(() => { if (location.pathname !== "/scan") return; scan.onScreenVisible(true); return () => scan.onScreenVisible(false); }, [location.pathname, scan.onScreenVisible]);
  return <><button onClick={() => navigate("/scan")}>Scan</button><button onClick={() => navigate("/settings")}>Settings</button><button onClick={() => void scan.ensureScan()}>Upload</button><button onClick={() => scan.onScreenVisible(true)}>Retry</button><video ref={scan.videoRef} /><canvas ref={scan.overlayRef} /><span>{scan.camera.phase}</span><span>{scan.reviewOpen ? "Review open" : "Review closed"}</span></>;
}
function App() { return <MemoryRouter><ScanProvider><Controls /></ScanProvider></MemoryRouter>; }
beforeEach(() => { vi.clearAllMocks(); fixture.init.mockImplementation(async (_ctx, host) => { fixture.host = host; }); fixture.camera.mockResolvedValue({ getTracks: () => [] }); });
test("leaving before initialization resolves never attaches a camera", async () => {
  const pending = deferred(); fixture.init.mockReturnValue(pending.promise); render(<App />); await userEvent.click(screen.getByText("Scan")); await waitFor(() => expect(fixture.init).toHaveBeenCalled()); await userEvent.click(screen.getByText("Settings")); await act(async () => pending.resolve()); expect(fixture.attach).not.toHaveBeenCalled(); expect(fixture.visible).not.toHaveBeenCalledWith(true, expect.anything());
});
test("permission returning after exit stops all returned tracks", async () => {
  const pending = deferred(); const stop = vi.fn(); fixture.camera.mockReturnValue(pending.promise); render(<App />); await userEvent.click(screen.getByText("Scan")); await waitFor(() => expect(fixture.camera).toHaveBeenCalled()); await userEvent.click(screen.getByText("Settings")); await act(async () => pending.resolve({ getTracks: () => [{ stop }] })); expect(stop).toHaveBeenCalled(); expect(fixture.attach).not.toHaveBeenCalled();
});
test("provider rerenders do not restart camera", async () => {
  const view = render(<App />); await userEvent.click(screen.getByText("Scan")); await waitFor(() => expect(fixture.attach).toHaveBeenCalledTimes(1)); view.rerender(<App />); expect(fixture.attach).toHaveBeenCalledTimes(1); expect(fixture.camera).toHaveBeenCalledTimes(1);
});
test("initialization before first Scan visit still attaches the later surface", async () => {
  render(<App />); await userEvent.click(screen.getByText("Upload")); await waitFor(() => expect(fixture.init).toHaveBeenCalledTimes(1)); await userEvent.click(screen.getByText("Scan")); await waitFor(() => expect(fixture.attach).toHaveBeenCalledTimes(1)); expect(fixture.init).toHaveBeenCalledTimes(1);
});
test("failed initialization is retryable", async () => {
  fixture.init.mockRejectedValueOnce(new Error("init failed")); render(<App />); await userEvent.click(screen.getByText("Scan")); await screen.findByText("failed"); await userEvent.click(screen.getByText("Retry")); await waitFor(() => expect(fixture.attach).toHaveBeenCalledTimes(1)); expect(fixture.init).toHaveBeenCalledTimes(2);
});
test("failed initialization cancels pending permission and retry gets a fresh activation", async () => {
  const pending = deferred();
  const initialization = deferred();
  const stop = vi.fn();
  fixture.camera.mockReturnValueOnce(pending.promise);
  fixture.init.mockImplementationOnce(async () => { await initialization.promise; throw new Error("init failed"); });
  render(<App />);
  await userEvent.click(screen.getByText("Scan"));
  await waitFor(() => expect(fixture.camera).toHaveBeenCalledTimes(1));
  await act(async () => initialization.resolve());
  await screen.findByText("failed");
  await act(async () => pending.resolve({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(fixture.attach).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Retry"));
  await waitFor(() => expect(fixture.attach).toHaveBeenCalledTimes(1));
});
test("processing completion on Settings cannot open review", async () => {
  render(<App />); await userEvent.click(screen.getByText("Scan")); await waitFor(() => expect(fixture.attach).toHaveBeenCalled()); await userEvent.click(screen.getByText("Settings")); act(() => fixture.host.openReview()); expect(screen.getByText("Review closed")).toBeTruthy();
});
