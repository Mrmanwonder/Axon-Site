import { readdirSync, readFileSync, statSync } from "node:fs";
import { expect, test } from "vitest";

// CLAUDE.md: red is reserved for signing out. Not errors, warnings, low scores,
// badges, or destructive rows such as deleting data.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(css|tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

test("red is only defined as tokens and consumed through --signout", () => {
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

test("--signout is consumed only by the sign-out row and the theme alias", () => {
  const users: string[] = [];
  for (const file of walk(`${process.cwd()}/src/ui`)) {
    if (file.endsWith("styles/tokens.css")) continue;
    if (/var\(--signout\)|--color-signout/.test(readFileSync(file, "utf8"))) users.push(file.replace(process.cwd() + "/", ""));
  }
  expect(users.sort()).toEqual(["src/ui/pages/Settings.tsx", "src/ui/styles/app.css"]);
});
