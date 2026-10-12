import { beforeEach, expect, test, vi } from "vitest";
const fake = vi.hoisted(() => ({ callbacks: [] as ((event: string, session: unknown) => void)[] }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: {
  onAuthStateChange: (fn: (event: string, session: unknown) => void) => {
    fake.callbacks.push(fn); return { data: { subscription: { unsubscribe() {} } } };
  },
} }) }));
vi.mock("../../src/cache.js", () => ({ clearLocalData: vi.fn(), putCached: vi.fn(), readThrough: vi.fn() }));
import { clearPasswordRecovery, onAuthChange } from "../../src/supabase.js";
const session = { user: { id: "guardian" } };
beforeEach(() => { fake.callbacks.splice(1); clearPasswordRecovery(); });
test("recovery arriving before React subscribes survives the later INITIAL_SESSION event", () => {
  fake.callbacks[0]("PASSWORD_RECOVERY", session);
  const listener = vi.fn(); onAuthChange(listener);
  fake.callbacks[1]("INITIAL_SESSION", session);
  expect(listener).toHaveBeenCalledWith(session, "PASSWORD_RECOVERY");
});
test("completed/cancelled recovery restores ordinary event handling", () => {
  fake.callbacks[0]("PASSWORD_RECOVERY", session); clearPasswordRecovery();
  const listener = vi.fn(); onAuthChange(listener);
  fake.callbacks[1]("TOKEN_REFRESHED", session);
  expect(listener).toHaveBeenCalledWith(session, "TOKEN_REFRESHED");
});
test("sign-out clears pending recovery so another account cannot inherit its reset view", () => {
  fake.callbacks[0]("PASSWORD_RECOVERY", session); fake.callbacks[0]("SIGNED_OUT", null);
  const listener = vi.fn(); onAuthChange(listener);
  fake.callbacks[1]("SIGNED_IN", { user: { id: "other" } });
  expect(listener).toHaveBeenCalledWith({ user: { id: "other" } }, "SIGNED_IN");
});
