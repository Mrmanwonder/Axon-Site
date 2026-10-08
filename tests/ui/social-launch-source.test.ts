import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(process.cwd(), "docs/claude/social/launch-trilogy");
const names = ["intro-01-problem", "intro-02-axon", "intro-03-release-alternative"];

describe("owner-directed introductory social asset sources", () => {
  for (const [index, name] of names.entries()) {
    test(name + " is a valid offline SVG at portrait feed size with clear sequence numbering", () => {
      const svg = fs.readFileSync(path.join(ROOT, name + ".svg"), "utf8");
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.getElementsByTagName("parsererror").length).toBe(0);
      const root = doc.documentElement;
      expect(root.getAttribute("viewBox")).toBe("0 0 1080 1350");
      expect(root.getAttribute("width")).toBe("1080");
      expect(root.getAttribute("height")).toBe("1350");
      expect(doc.querySelectorAll("text").length).toBeGreaterThan(4);
      expect(svg).toContain(`${index + 1} / 3`);
      expect(svg).toContain("axonstudy.online");
      expect(svg).not.toMatch(/https?:\/\/[^\s"]+\.(?:jpg|png|woff|svg)/i);
    });
  }

  test("proposed launch never invents a public date or portrays illustrative product flow as live app UI", () => {
    const text = fs.readFileSync(path.join(ROOT, "intro-03-release-alternative.svg"), "utf8");
    expect(text).toContain("Date to be announced.");
    const intro = fs.readFileSync(path.join(ROOT, "intro-02-axon.svg"), "utf8");
    expect(intro).toContain("Illustrative explanation");
    expect(intro).toContain("teacher");
  });

  test("the owner-preferred third design remains untouched; alternative uses the actual Axon lockup paths", () => {
    const alternative = fs.readFileSync(path.join(ROOT, "intro-03-release-alternative.svg"), "utf8");
    const official = fs.readFileSync(path.resolve(process.cwd(), "public/axon-lockup-v2.svg"), "utf8");
    const d = [...official.matchAll(/<path d="([^"]+)"/g)].map(x=>x[1]);
    expect(d.length).toBeGreaterThan(3);
    for (const p of d) expect(alternative).toContain(`d="${p}"`);
  });
});
