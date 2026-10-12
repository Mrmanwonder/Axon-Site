// AXO-234: a parent whose password is held by WorkOS has no Supabase password,
// so Parent Mode must not offer "Use my password" while the WorkOS flag is on.
import { renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ workos: false, openSheet: vi.fn() }));
vi.mock("../../src/ui/components/SheetProvider", () => ({ useSheetControls: () => ({ openSheet: fixture.openSheet }) }));
vi.mock("../../src/ui/components/ToastProvider", () => ({ useToast: () => vi.fn() }));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ guardian: { contact: "parent@example.test" } }) }));
vi.mock("../../src/ui/data/modules", () => ({
  parentModeState: async () => ({ fresh: false, amrPresent: true, windowSeconds: 900, ageSeconds: 2000, remainingSeconds: 0 }),
  sendParentCode: vi.fn(), unlockWithCode: vi.fn(), unlockWithPassword: vi.fn(),
  get WORKOS_PASSWORD() { return fixture.workos; },
}));

import { useParentMode } from "../../src/ui/data/useParentMode";

beforeEach(() => { fixture.openSheet.mockReset(); });

async function choicesOffered() {
  const { result } = renderHook(() => useParentMode());
  result.current.guard(() => {});
  await vi.waitFor(() => expect(fixture.openSheet).toHaveBeenCalled());
  return (fixture.openSheet.mock.calls[0][0].choices as { value: string }[]).map((c) => c.value);
}

test("without WorkOS, an email account can unlock with a code or its password", async () => {
  fixture.workos = false;
  expect(await choicesOffered()).toEqual(["code", "password"]);
});

test("with WorkOS, only the code is offered", async () => {
  fixture.workos = true;
  expect(await choicesOffered()).toEqual(["code"]);
});
