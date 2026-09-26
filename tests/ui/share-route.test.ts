import { expect, test } from "vitest";
import { isAcademicSharePath } from "../../src/ui/lib/shareRoute";

test("the exact share route and its host-normalized slash form exclude analytics", () => {
  expect(isAcademicSharePath("/share")).toBe(true);
  expect(isAcademicSharePath("/share/")).toBe(true);
});

test("other routes keep normal consent handling", () => {
  for (const path of ["/", "/privacy", "/shared", "/share/other", "/library"]) {
    expect(isAcademicSharePath(path)).toBe(false);
  }
});
