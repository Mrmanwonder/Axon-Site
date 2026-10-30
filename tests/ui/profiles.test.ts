import { beforeEach, expect, test, vi } from "vitest";
import { loadProfiles } from "../../src/ui/data/profiles";

const fixture = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../src/ui/data/modules", () => ({
  sb: { from: (table: string) => ({ select: () => ({
    eq: () => ({ order: () => fixture.read(table) }),
    in: () => fixture.read(table),
  }) }) },
}));
vi.mock("../../src/cache.js", () => ({
  readThrough: async (_key: string, read: () => Promise<unknown>) => ({ data: await read(), stale: false }),
}));

function deferred() {
  let resolve!: (value: { data: object[]; error?: Error }) => void;
  const promise = new Promise<{ data: object[]; error?: Error }>(yes => { resolve = yes; });
  return { promise, resolve };
}

const student = { id: "student", programme_id: "programme", stage_id: "stage" };
beforeEach(() => {
  fixture.read.mockReset().mockImplementation(async (table: string) => ({ data:
    table === "student" ? [student] :
    table === "curriculum_programme" ? [{ id: "programme", provider_id: "provider", key: "programme-key", label: "Programme" }] :
    table === "curriculum_provider" ? [{ id: "provider", key: "provider-key", name: "Provider" }] :
    table === "curriculum_stage" ? [{ id: "stage", key: "stage-key", label: "Stage", school_year_label: "Year 12" }] :
    [{ student_id: "student", subject: "Physics", subject_offering_id: "offering", selected_level: "HL", external_code_snapshot: "code" }],
  }));
});

test("curriculum and providers do not wait for subjects, and the complete profile stays intact", async () => {
  const subjects = deferred();
  const read = fixture.read.getMockImplementation()!;
  fixture.read.mockImplementation((table: string) => table === "student_subject" ? subjects.promise : read(table));
  let complete = false;
  const pending = loadProfiles("guardian").then(result => { complete = true; return result; });
  await vi.waitFor(() => expect(fixture.read).toHaveBeenCalledWith("curriculum_provider"));
  expect(fixture.read).toHaveBeenCalledWith("curriculum_stage");
  expect(complete).toBe(false);
  subjects.resolve({ data: [{ student_id: "student", subject: "Physics", subject_offering_id: "offering", selected_level: "HL", external_code_snapshot: "code" }] });
  const result = await pending;
  expect(result.stale).toBe(false);
  expect(result.data[0]).toMatchObject({
    ...student, provider_key: "provider-key", programme_key: "programme-key", stage_key: "stage-key",
    subjects: ["Physics"], subject_selections: [{ offering_id: "offering", subject: "Physics", external_code: "code", level: "HL" }],
  });
});

test("a failed independent read cannot become an incomplete live profile", async () => {
  const read = fixture.read.getMockImplementation()!;
  fixture.read.mockImplementation((table: string) => table === "student_subject"
    ? Promise.resolve({ data: null, error: new Error("subjects unavailable") }) : read(table));
  await expect(loadProfiles("guardian")).rejects.toThrow("subjects unavailable");
});
