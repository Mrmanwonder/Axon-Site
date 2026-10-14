import { readdirSync, readFileSync, statSync } from "node:fs";
import { expect, test } from "vitest";

// Red is reserved for Sign out and destructive deletes (papers / account),
// consumed only through --danger; deletes also carry a hazard icon.
// Not errors, warnings, low scores or badges (owner, 14 Oct 2026).
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(css|tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

test("red is only defined as tokens and consumed through --danger", () => {
  const offenders: string[] = [];
  for (const file of walk(`${process.cwd()}/src/ui`)) {
    if (file.endsWith("styles/tokens.css")) continue; // token definitions live here
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/var\(--red\)|var\(--p-red|--p-red-|#FF6B57|#D8462F/i.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(offenders, offenders.join("\n")).toEqual([]);
});

test("--danger is consumed only by the Settings sign-out and delete rows", () => {
  const users: string[] = [];
  for (const file of walk(`${process.cwd()}/src/ui`)) {
    if (file.endsWith("styles/tokens.css")) continue;
    if (/var\(--danger\)/.test(readFileSync(file, "utf8"))) users.push(file.replace(process.cwd() + "/", ""));
  }
  expect(users.sort()).toEqual(["src/ui/pages/Settings.tsx", "src/ui/styles/review-2026-10.css"]);
});

test("Sign out and both deletes are red, and only the deletes carry the hazard icon", () => {
  const src = readFileSync(`${process.cwd()}/src/ui/pages/Settings.tsx`, "utf8");
  for (const label of ["Sign out", "Delete the papers", "Delete this account"]) {
    expect(src).toMatch(new RegExp(`style=\\{\\{ color: "var\\(--danger\\)" \\}\\}>${label}`));
  }
  for (const label of ["Delete the papers", "Delete this account"]) {
    expect(src).toMatch(new RegExp(`<MaterialSymbol name="warning"[^>]*/>\\s*<div className="lbl"[^>]*>${label}`));
  }
  expect((src.match(/name="warning"/g) ?? []).length).toBe(2);
});

import { isTablet } from "../../src/ui/scan/useDeskMode";
test("tablets are told apart from laptops", () => {
  expect(isTablet("Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/129 Safari/537.36", 10)).toBe(true);
  expect(isTablet("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", 5)).toBe(true);
  expect(isTablet("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", 0)).toBe(false);
  expect(isTablet("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129 Safari/537.36", 10)).toBe(false);
});
