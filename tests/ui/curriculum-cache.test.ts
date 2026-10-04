import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ calls: [] as string[], failProviders: false }));
vi.mock("../../src/supabase.js", () => ({ sb: { from(table: string) {
  fixture.calls.push(table);
  const rows: Record<string, object[]> = {
    curriculum_provider: [{ id: "provider", key: "cambridge", name: "Cambridge" }],
    curriculum_programme: [{ id: "programme", provider_id: "provider", key: "cambridge_igcse" }],
    curriculum_stage: [{ id: "stage", programme_id: "programme", key: "cambridge_igcse_y10" }],
    subject_offering: [{ id: "math", display_name: "Mathematics", external_code: "0580" }],
  };
  const builder = {
    select: () => builder, eq: () => builder, order: () => builder,
    then(resolve: (value: object) => unknown) {
      return Promise.resolve({ data: rows[table], error: table === "curriculum_provider" && fixture.failProviders ? new Error("offline") : null }).then(resolve);
    },
    single: () => Promise.resolve({ data: rows[table][0], error: null }),
  };
  return builder;
} } }));

beforeEach(() => { fixture.calls = []; fixture.failProviders = false; vi.resetModules(); });

test("subject loading reuses catalogue identities instead of fetching programme and stage again", async () => {
  const catalog = await import("../../src/curriculum.js");
  await catalog.getProgrammes("cambridge");
  await catalog.getStages("cambridge_igcse");
  const offerings = await catalog.getSubjectOfferings({ programmeKey: "cambridge_igcse", stageKey: "cambridge_igcse_y10" });
  expect(offerings[0].external_code).toBe("0580");
  expect(fixture.calls).toEqual(["curriculum_provider", "curriculum_programme", "curriculum_stage", "subject_offering"]);
});

test("a failed catalogue request is evicted so retry can recover", async () => {
  const catalog = await import("../../src/curriculum.js");
  fixture.failProviders = true;
  await expect(catalog.getProgrammes("cambridge")).rejects.toThrow("offline");
  fixture.failProviders = false;
  expect((await catalog.getProgrammes("cambridge"))[0].key).toBe("cambridge_igcse");
});
