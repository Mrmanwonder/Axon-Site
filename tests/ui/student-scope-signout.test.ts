import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  trace: [] as string[],
  rpc: vi.fn(),
  authSignOut: vi.fn(),
  clearLocal: vi.fn(),
}));

vi.mock("../../src/cache.js", () => ({
  readThrough: vi.fn(),
  clearLocalData: async () => {
    fixture.trace.push("local");
    await fixture.clearLocal();
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: fixture.rpc,
    auth: {
      signOut: fixture.authSignOut,
    },
  }),
}));

import { signOut } from "../../src/supabase.js";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.trace.length = 0;
  fixture.clearLocal.mockResolvedValue(undefined);
  fixture.rpc.mockImplementation(async (name: string) => {
    if (name === "clear_student_scope") {
      fixture.trace.push("scope");
      return { data: true, error: null };
    }
    throw new Error("unexpected rpc " + name);
  });
  fixture.authSignOut.mockImplementation(async () => {
    fixture.trace.push("auth");
    return { error: null };
  });
});

test("sign-out revokes Student Mode before local cleanup and auth termination", async () => {
  await signOut();

  expect(fixture.trace).toEqual(["scope", "local", "auth"]);
  expect(fixture.rpc).toHaveBeenCalledWith("clear_student_scope");
});

test("scope revocation failure cannot strand the guardian signed in", async () => {
  fixture.rpc.mockImplementation(async () => {
    fixture.trace.push("scope");
    return { data: null, error: new Error("database unavailable") };
  });

  await signOut();

  expect(fixture.trace).toEqual(["scope", "local", "auth"]);
  expect(fixture.authSignOut).toHaveBeenCalledTimes(1);
});
