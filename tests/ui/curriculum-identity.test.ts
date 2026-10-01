import { describe, expect, test, vi } from "vitest";

vi.mock("../../src/supabase.js", () => ({ sb: {} }));

import {
  assessmentRulesFor, classLabel, classLabelShort, legacyCurriculumForStudent,
  paperLabelsFor, providerKeyForBoard, providerKeyForStudent, stageForClass,
} from "../../src/curriculum.js";
import { PAPER_TYPES, paperTypeLabel, paperTypesFor } from "../../src/papers.js";

// AXO-94: missing or unrecognised curriculum identity must never become Cambridge.
const UNKNOWN_BOARDS = [undefined, null, "", "ICSE", "STATE", "cbse", "caie", "IB", "SOMETHING_NEW"];

describe("provider resolution", () => {
  test("only the explicit legacy Cambridge boards map to Cambridge", () => {
    for (const board of ["CAIE", "IGCSE", "AS_A_LEVEL"]) expect(providerKeyForBoard(board)).toBe("cambridge");
    expect(providerKeyForBoard("CBSE")).toBe("cbse");
    expect(providerKeyForBoard("IBDP")).toBe("ib");
  });

  test.each(UNKNOWN_BOARDS)("unknown board %j is unknown, not Cambridge", (board) => {
    expect(providerKeyForBoard(board as string)).toBeNull();
    expect(providerKeyForStudent({ board } as never)).toBeNull();
  });

  test("a stored provider_key wins; an invalid stored key falls through to the board, never to Cambridge", () => {
    expect(providerKeyForStudent({ provider_key: "ib", board: "CAIE" })).toBe("ib");
    expect(providerKeyForStudent({ provider_key: "mystery", board: "ICSE" })).toBeNull();
    expect(providerKeyForStudent(null)).toBeNull();
    expect(providerKeyForStudent(undefined)).toBeNull();
  });
});

describe("paper vocabulary", () => {
  test("Cambridge, CBSE and IB keep their own labels", () => {
    expect(paperTypeLabel("pyq", "cambridge")).toBe("Cambridge past paper");
    expect(paperTypeLabel("sample_paper", "cambridge")).toBe("Specimen paper");
    expect(paperTypeLabel("pyq", "cbse")).toBe("Board paper");
    expect(paperTypeLabel("sample_paper", "cbse")).toBe("Sample Question Paper");
    expect(paperTypeLabel("pyq", "ib")).toBe("Examination paper");
    expect(paperTypeLabel("sample_paper", "ib")).toBe("Official sample paper");
  });

  test.each([undefined, null, "", "icse", "mystery"])("provider %j gets neutral labels", (provider) => {
    expect(paperTypeLabel("pyq", provider as string)).toBe("Past paper");
    expect(paperTypeLabel("sample_paper", provider as string)).toBe("Sample paper");
    const labels = paperTypesFor(provider as string).map((t: { label: string }) => t.label).join("|");
    expect(labels).not.toMatch(/cambridge|specimen/i);
  });

  test("calling without provider context is neutral and the compatibility constant carries no Cambridge", () => {
    expect(paperTypeLabel("pyq")).toBe("Past paper");
    expect(JSON.stringify(PAPER_TYPES)).not.toMatch(/cambridge|specimen/i);
    expect(paperLabelsFor(undefined)).toEqual({ pyq: "Past paper", sample_paper: "Sample paper" });
  });

  test("assessment rules for an unknown provider use neutral terminology", () => {
    const rules = assessmentRulesFor({});
    expect(rules.provider).toBeNull();
    expect(rules.officialSchemeTerminology).toBe("marking scheme");
    expect(rules.paperLabels.pyq).toBe("Past paper");
    expect(assessmentRulesFor({ providerKey: "cambridge" }).officialSchemeTerminology).toBe("mark scheme");
  });
});

describe("legacy identity", () => {
  const unresolved = { providerKey: null, programmeKey: null, stageKey: null };

  test.each(UNKNOWN_BOARDS)("board %j with a plausible class stays unresolved", (board) => {
    expect(legacyCurriculumForStudent({ board, class_level: 11 } as never)).toEqual(unresolved);
  });

  test("Cambridge requires a valid class: missing/invalid class is not IGCSE and not A Level", () => {
    for (const class_level of [undefined, null, NaN, 0, 8, 13, 10.5, "x"]) {
      const out = legacyCurriculumForStudent({ board: "CAIE", class_level } as never);
      expect(out).toEqual({ providerKey: "cambridge", programmeKey: null, stageKey: null });
    }
  });

  test("explicit legacy Cambridge, CBSE and IB rows still resolve", () => {
    expect(legacyCurriculumForStudent({ board: "CAIE", class_level: 9 } as never).stageKey).toBe("cambridge_igcse_y10");
    expect(legacyCurriculumForStudent({ board: "IGCSE", class_level: 10 } as never).stageKey).toBe("cambridge_igcse_y11");
    expect(legacyCurriculumForStudent({ board: "AS_A_LEVEL", class_level: 11 } as never).programmeKey).toBe("cambridge_as");
    expect(legacyCurriculumForStudent({ board: "CAIE", class_level: 12 } as never).programmeKey).toBe("cambridge_a_level");
    expect(legacyCurriculumForStudent({ board: "CBSE", class_level: 10 } as never)).toEqual({ providerKey: "cbse", programmeKey: "cbse_secondary", stageKey: "cbse_10" });
    expect(legacyCurriculumForStudent({ board: "CBSE", class_level: 12 } as never).programmeKey).toBe("cbse_senior_secondary");
    expect(legacyCurriculumForStudent({ board: "CBSE", class_level: undefined } as never)).toEqual({ providerKey: "cbse", programmeKey: null, stageKey: null });
    expect(legacyCurriculumForStudent({ board: "IBDP" } as never).providerKey).toBe("ib");
  });

  test("a stored normalised identity is returned as stored", () => {
    expect(legacyCurriculumForStudent({ provider_key: "ib", programme_key: "ibdp", stage_key: "ibdp_1", board: "CAIE" } as never))
      .toEqual({ providerKey: "ib", programmeKey: "ibdp", stageKey: "ibdp_1" });
  });
});

describe("legacy class/stage labels", () => {
  test("an invalid class has no stage and says so instead of IGCSE", () => {
    expect(stageForClass(NaN)).toBeNull();
    expect(stageForClass(8)).toBeNull();
    expect(classLabel(NaN)).toBe("Stage not set");
    expect(classLabelShort(undefined as never)).toBe("Stage not set");
    expect(stageForClass(9)?.stage).toBe("igcse");
    expect(classLabel(12)).toBe("A Level · Year 13");
  });
});

describe("provider context reaches every surface that renders a paper type", () => {
  test("no UI call to paperTypeLabel omits the provider argument", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const page of ["Home", "Library", "Insights", "PaperOverview", "QuestionDetail"]) {
      const source = await readFile(`${process.cwd()}/src/ui/pages/${page}.tsx`, "utf8");
      const calls = [...source.matchAll(/paperTypeLabel\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => m[1]);
      expect(calls.length, `${page} renders a paper type`).toBeGreaterThan(0);
      for (const args of calls) expect(args, `${page}: paperTypeLabel(${args})`).toMatch(/,/);
    }
  });

  test("the scanner no longer defines its own Cambridge-defaulting provider helper", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(`${process.cwd()}/src/scan/ui.js`, "utf8");
    expect(source).not.toMatch(/return 'cambridge'/);
    expect(source).toMatch(/providerKeyForStudent/);
  });
});
