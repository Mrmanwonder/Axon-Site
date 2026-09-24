import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { canonicalAssetUrl } from "../../src/papers";

test("repairs the known dead Worker origin without changing the signed path", () => {
  const broken = "https://mastery-api.workers.dev/asset/derived/student%2Fpaper%2Fpage.webp?exp=123&sig=abc";
  const repaired = canonicalAssetUrl(broken);
  expect(repaired).toBe(
    "https://mastery-api.tanmay-harkawat.workers.dev/asset/derived/student%2Fpaper%2Fpage.webp?exp=123&sig=abc",
  );
});

test("leaves configured custom asset origins alone", () => {
  const custom = "https://assets.example.test/asset/derived/key?exp=123&sig=abc";
  expect(canonicalAssetUrl(custom)).toBe(custom);
});


test("every production CSP permits the Worker-served signed page image", () => {
  const origin = "https://mastery-api.tanmay-harkawat.workers.dev";
  for (const path of ["src/index.ts", "public/_headers", "netlify.toml"]) {
    const source = readFileSync(path, "utf8");
    const imagePolicy = source.match(/img-src[^;\n]*/)?.[0] ?? "";
    expect(imagePolicy, path).toContain(origin);
  }
});
