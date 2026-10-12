import { describe, expect, it } from "vitest";

describe("takeProviderError", () => {
  it("reads an expired emailed link as an expired link, not a cancelled provider", async () => {
    window.history.replaceState(null, "", "/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    const { takeProviderError } = await import("../../src/supabase.js");
    const err = takeProviderError();
    expect(err?.message).toMatch(/expired or was already used/);
    expect(err?.message).not.toMatch(/cancelled/);
  });
});
