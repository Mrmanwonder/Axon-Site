import { describe, expect, it } from "vitest";
import { classifyImport, IMPORT_ACCEPT, pdfPageBudget, pdfRenderScale } from "../../src/scan/import-decode.js";
import { CAPTURE, CONDITIONING } from "../../src/scan/contract.js";

describe("classifyImport", () => {
  it("reads the MIME type first", () => {
    expect(classifyImport({ type: "application/pdf", name: "x.bin" })).toBe("pdf");
    expect(classifyImport({ type: "image/heic", name: "x" })).toBe("heic");
    expect(classifyImport({ type: "image/heif", name: "x" })).toBe("heic");
    expect(classifyImport({ type: "image/jpeg", name: "x.pdf" })).toBe("image");
    expect(classifyImport({ type: "image/png", name: "" })).toBe("image");
  });

  it("falls back to the name when a picker, paste or drag gives no type", () => {
    expect(classifyImport({ type: "", name: "Paper 1.PDF" })).toBe("pdf");
    expect(classifyImport({ type: "", name: "IMG_0042.HEIC" })).toBe("heic");
    expect(classifyImport({ type: "application/octet-stream", name: "IMG_0042.heif" })).toBe("heic");
    expect(classifyImport({ type: "", name: "scan.jpeg" })).toBe("image");
  });

  it("refuses what Axon cannot read", () => {
    expect(classifyImport({ type: "text/plain", name: "notes.txt" })).toBeNull();
    expect(classifyImport({ type: "application/msword", name: "paper.doc" })).toBeNull();
    expect(classifyImport({ type: "", name: "paper" })).toBeNull();
    expect(classifyImport(null)).toBeNull();
  });

  it("every type the pipeline contract accepts is importable", () => {
    for (const type of CAPTURE.ACCEPTED_TYPES) expect(classifyImport({ type, name: "" })).not.toBeNull();
  });

  it("the picker offers PDFs and HEIC", () => {
    expect(IMPORT_ACCEPT).toContain("application/pdf");
    expect(IMPORT_ACCEPT).toContain(".heic");
  });
});

describe("pdfRenderScale", () => {
  it("renders the long edge at the conditioning target", () => {
    const a4 = { w: 595, h: 842 };
    const s = pdfRenderScale(a4.w, a4.h);
    expect(Math.round(a4.h * s)).toBe(CONDITIONING.PAGE_LONG_EDGE);
    expect(Math.round(a4.w * s)).toBeLessThan(CONDITIONING.PAGE_LONG_EDGE);
  });

  it("uses the longer edge for a landscape page", () => {
    expect(Math.round(842 * pdfRenderScale(842, 595))).toBe(CONDITIONING.PAGE_LONG_EDGE);
  });

  it("refuses a page with no size", () => {
    expect(() => pdfRenderScale(0, 0)).toThrow();
  });
});

describe("pdfPageBudget", () => {
  it("takes every page when there is room", () => {
    expect(pdfPageBudget(12, 0)).toEqual({ take: 12, refused: 0 });
  });

  it("stops at the paper's page limit and says how many did not fit", () => {
    expect(pdfPageBudget(30, 0)).toEqual({ take: CAPTURE.MAX_PAGES, refused: 30 - CAPTURE.MAX_PAGES });
    expect(pdfPageBudget(10, 20)).toEqual({ take: 5, refused: 5 });
    expect(pdfPageBudget(3, 25)).toEqual({ take: 0, refused: 3 });
  });
});
