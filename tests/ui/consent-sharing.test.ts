import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("../../src/supabase.js", () => ({ sb: { from: (table: string) => table === "consent_current"
  ? { select: () => ({ eq: mocks.read }) }
  : { insert: () => ({ select: mocks.write }) } } }));
import { readConsentCurrentRows, recordConsent, forgetInflightConsent } from "../../src/consent.js";
beforeEach(() => { forgetInflightConsent(); mocks.read.mockReset(); mocks.write.mockReset(); });
test("concurrent consent readers share only until the request settles", async () => {
  mocks.read.mockResolvedValue({ data: [] });
  await Promise.all([readConsentCurrentRows("g"), readConsentCurrentRows("g")]);
  expect(mocks.read).toHaveBeenCalledTimes(1);
  await readConsentCurrentRows("g"); expect(mocks.read).toHaveBeenCalledTimes(2);
});
test("a pre-withdrawal answer and a read racing the write cannot return stale grants", async () => {
  let finishOld!: (v: unknown) => void, finishWrite!: (v: unknown) => void, finishDuring!: (v: unknown) => void;
  mocks.read.mockImplementationOnce(() => new Promise(r => { finishOld = r; }));
  const old = readConsentCurrentRows("g");
  const oldRejected = expect(old).rejects.toThrow("Consent changed");
  mocks.write.mockImplementationOnce(() => new Promise(r => { finishWrite = r; }));
  const write = recordConsent({ guardianId: "g", decisions: { processing: false } });
  mocks.read.mockImplementationOnce(() => new Promise(r => { finishDuring = r; }));
  const during = readConsentCurrentRows("g");
  const duringRejected = expect(during).rejects.toThrow("Consent changed");
  finishWrite({ data: [] }); await write;
  finishOld({ data: [{ granted: true }] }); finishDuring({ data: [{ granted: true }] });
  await Promise.all([oldRejected, duringRejected]);
  mocks.read.mockResolvedValue({ data: [{ granted: false }] });
  expect(await readConsentCurrentRows("g")).toEqual([{ granted: false }]);
});
