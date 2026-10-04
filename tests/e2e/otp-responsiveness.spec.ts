import { test, expect } from "@playwright/test";

test("slow OTP delivery opens code entry immediately, recovers from failure, and fits phone/tablet layouts", async ({ page }) => {
  // Mock the transport before app startup so both browser engines avoid a
  // real cross-origin preflight while exercising the actual Supabase client.
  await page.addInitScript(() => {
    const control = window as unknown as { __axoOtpAttempts: number; __axoReleaseOtp: () => void };
    control.__axoOtpAttempts = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.includes("/auth/v1/otp")) return originalFetch(input, init);
      control.__axoOtpAttempts++;
      return new Promise<Response>(resolve => {
        control.__axoReleaseOtp = () => resolve(new Response(JSON.stringify({ msg: "Simulated delivery outage" }), {
          status: 503, headers: { "Content-Type": "application/json" },
        }));
      });
    };
  });
  await page.goto("http://127.0.0.1:5175/");
  await page.getByRole("button", { name: /reject|essential only|necessary only/i }).click();
  await page.getByRole("button", { name: /a parent/ }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Test Parent");
  await page.getByLabel("Email or phone").fill("parent@example.test");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Sending a code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __axoOtpAttempts: number }).__axoOtpAttempts)).toBe(1);
  for (const [width, height] of [[390,844],[844,390],[768,1024],[1200,900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByLabel("Your code")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.evaluate(() => (window as unknown as { __axoReleaseOtp: () => void }).__axoReleaseOtp());
  await expect(page.getByRole("alert")).toContainText("could not be sent");
  await expect(page.getByRole("status").filter({ hasText: "has not been sent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try sending again" })).toBeEnabled();
});
