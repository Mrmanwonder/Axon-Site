import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
vi.mock("../../src/ui/data/AppProvider", () => ({ AppProvider: ({ children }: any) => children, useApp: () => ({ gate: "loading", passwordRecovery: false }) }));
vi.mock("../../src/ui/data/modules", () => ({ readReconfirmation: vi.fn() }));
vi.mock("../../src/ui/data/useIngestion", () => ({ IngestionProvider: ({ children }: any) => children }));
vi.mock("../../src/ui/scan/ScanProvider", () => ({ ScanProvider: ({ children }: any) => children }));
vi.mock("../../src/ui/shell/AppShell", () => ({ default: () => null }));
vi.mock("../../src/ui/components/ProfileChooser", () => ({ default: () => null }));
import { Gate } from "../../src/ui/shell/Root";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });
test("SecurityError reading storage still renders the correct loading gate", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
  render(<MemoryRouter><Gate /></MemoryRouter>);
  expect(screen.getByRole("status", { name: "Loading your Axon workspace" })).toBeTruthy();
});
test("absent storage still renders the gate", () => {
  vi.stubGlobal("sessionStorage", undefined);
  render(<MemoryRouter><Gate /></MemoryRouter>);
  expect(screen.getByRole("status", { name: "Loading your Axon workspace" })).toBeTruthy();
});
test("a recorded cleanup failure still takes precedence", () => {
  sessionStorage.setItem("axon.cleanup-error", "Cleanup failed");
  render(<MemoryRouter><Gate /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Local cleanup needs attention" })).toBeTruthy();
});
