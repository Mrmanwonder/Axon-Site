import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { LEGAL_EFFECTIVE_DATE, LEGAL_LAST_UPDATED, SUPPORT_EMAIL, SUPPORT_MAILTO } from "../../src/ui/lib/legal";

const root = process.cwd();

test("the support/privacy contact is support@axonstudy.online and is defined once", () => {
  expect(SUPPORT_EMAIL).toBe("support@axonstudy.online");
  expect(SUPPORT_MAILTO).toBe("mailto:support@axonstudy.online");
  for (const page of ["Privacy", "Terms", "Cookies"]) {
    const source = readFileSync(`${root}/src/ui/pages/${page}.tsx`, "utf8");
    expect(source, `${page} uses the shared constant`).toMatch(/SUPPORT_EMAIL/);
    expect(source, `${page} has no hard-coded address`).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
  }
});

test("no public surface carries a different contact address", () => {
  const files = [
    ...readdirSync(`${root}/src/ui/pages`).map((f) => `src/ui/pages/${f}`),
    ...readdirSync(`${root}/public`).filter((f) => /\.(html|txt|xml|webmanifest|svg)$/.test(f)).map((f) => `public/${f}`),
    "index.html",
  ];
  for (const file of files) {
    const text = readFileSync(`${root}/${file}`, "utf8");
    for (const address of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) ?? []) {
      expect(address, `${file}`).toBe(SUPPORT_EMAIL);
    }
  }
});

test("publication dates live in one constant and are well-formed", () => {
  for (const value of [LEGAL_EFFECTIVE_DATE, LEGAL_LAST_UPDATED]) expect(value).toMatch(/^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
});
