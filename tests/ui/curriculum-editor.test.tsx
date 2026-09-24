import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const offering = (id: string, display_name: string, external_code: string, levels_supported: ("SL" | "HL")[] = []) => ({
  id,
  programme_id: "programme",
  stage_id: "stage",
  subject_id: "subject-" + id,
  display_name,
  external_code,
  external_code_kind: "syllabus_code",
  levels_supported,
  language_code: null,
  variant: null,
  aliases: [],
  metadata: {},
});

vi.mock("../../src/ui/data/modules", () => ({
  PROVIDER_KEYS: ["cambridge", "cbse", "ib"],
  providerLabel: (key: string) => ({ cambridge: "Cambridge", cbse: "CBSE", ib: "IB Diploma" }[key] ?? key),
  defaultLevelFor: (row: { levels_supported: ("SL" | "HL")[] }) =>
    row.levels_supported.length === 1 ? row.levels_supported[0] : null,
  filterSubjectOfferings: (rows: Array<{ display_name: string; external_code: string }>, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      row.display_name.toLowerCase().includes(q) || row.external_code.toLowerCase().includes(q)
    );
  },
  getProgrammes: async (providerKey: string) => {
    if (providerKey === "cambridge") return [
      { id: "p-igcse", provider_id: "cambridge", key: "cambridge_igcse", label: "Cambridge IGCSE", metadata: {} },
      { id: "p-as", provider_id: "cambridge", key: "cambridge_as", label: "Cambridge AS", metadata: {} },
      { id: "p-a", provider_id: "cambridge", key: "cambridge_a_level", label: "Cambridge A Level", metadata: {} },
    ];
    if (providerKey === "cbse") return [
      { id: "p-cbse-s", provider_id: "cbse", key: "cbse_secondary", label: "CBSE Secondary", metadata: {} },
      { id: "p-cbse-ss", provider_id: "cbse", key: "cbse_senior_secondary", label: "CBSE Senior Secondary", metadata: {} },
    ];
    return [{ id: "p-ib", provider_id: "ib", key: "ibdp", label: "IB Diploma Programme", metadata: {} }];
  },
  getStages: async (programmeKey: string) => {
    const rows: Record<string, unknown[]> = {
      cambridge_igcse: [
        { id: "s-c9", programme_id: "p-igcse", key: "cambridge_igcse_y10", label: "IGCSE", school_year_label: "Year 10", legacy_class_level: 9, sort_order: 9, metadata: {} },
        { id: "s-c10", programme_id: "p-igcse", key: "cambridge_igcse_y11", label: "IGCSE", school_year_label: "Year 11", legacy_class_level: 10, sort_order: 10, metadata: {} },
      ],
      cambridge_as: [
        { id: "s-c11", programme_id: "p-as", key: "cambridge_as", label: "AS Level", school_year_label: "Year 12", legacy_class_level: 11, sort_order: 11, metadata: {} },
      ],
      cambridge_a_level: [
        { id: "s-c12", programme_id: "p-a", key: "cambridge_a_level", label: "A Level", school_year_label: "Year 13", legacy_class_level: 12, sort_order: 12, metadata: {} },
      ],
      cbse_secondary: [
        { id: "s-b9", programme_id: "p-cbse-s", key: "cbse_9", label: "Class 9", school_year_label: null, legacy_class_level: 9, sort_order: 9, metadata: {} },
        { id: "s-b10", programme_id: "p-cbse-s", key: "cbse_10", label: "Class 10", school_year_label: null, legacy_class_level: 10, sort_order: 10, metadata: {} },
      ],
      cbse_senior_secondary: [
        { id: "s-b11", programme_id: "p-cbse-ss", key: "cbse_11", label: "Class 11", school_year_label: null, legacy_class_level: 11, sort_order: 11, metadata: {} },
        { id: "s-b12", programme_id: "p-cbse-ss", key: "cbse_12", label: "Class 12", school_year_label: null, legacy_class_level: 12, sort_order: 12, metadata: {} },
      ],
      ibdp: [
        { id: "s-i11", programme_id: "p-ib", key: "ibdp_1", label: "DP1", school_year_label: null, legacy_class_level: 11, sort_order: 11, metadata: {} },
        { id: "s-i12", programme_id: "p-ib", key: "ibdp_2", label: "DP2", school_year_label: null, legacy_class_level: 12, sort_order: 12, metadata: {} },
      ],
    };
    return rows[programmeKey] ?? [];
  },
  getSubjectOfferings: async ({ programmeKey }: { programmeKey: string; stageKey: string }) => {
    if (programmeKey === "ibdp") return [
      offering("math", "Mathematics", "AA", ["SL", "HL"]),
      offering("physics", "Physics", "PHYS", ["SL", "HL"]),
    ];
    return [
      offering("math", "Mathematics", programmeKey.startsWith("cambridge") ? "9709" : "041"),
      offering("physics", "Physics", programmeKey.startsWith("cambridge") ? "9702" : "042"),
      offering("chem", "Chemistry", programmeKey.startsWith("cambridge") ? "9701" : "043"),
    ];
  },
}));

import CurriculumEditor from "../../src/ui/components/CurriculumEditor";
import type { CurriculumSelection } from "../../src/ui/components/CurriculumEditor";

function Harness({ initial }: { initial?: CurriculumSelection }) {
  const [value, setValue] = useState<CurriculumSelection>(initial ?? {
    providerKey: "cambridge",
    programmeKey: "",
    stageKey: "",
    subjects: [],
  });
  return <>
    <CurriculumEditor value={value} onChange={setValue} />
    <output data-testid="selection">{JSON.stringify({
      providerKey: value.providerKey,
      programmeKey: value.programmeKey,
      stageKey: value.stageKey,
      subjects: value.subjects.map(item => [item.offering.display_name, item.level]),
    })}</output>
  </>;
}

test("board and class determine the stage automatically while subjects stay inline", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const classGroup = screen.getByRole("group", { name: "Class" });
  await waitFor(() => expect(within(classGroup).getByRole("button", { name: "Class 11" }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.getByText("AS Level · Year 12")).toBeTruthy();

  const boardGroup = screen.getByRole("group", { name: "Board" });
  expect(within(boardGroup).getAllByRole("button")).toHaveLength(3);
  expect(within(boardGroup).getByRole("button", { name: "Cambridge" }).getAttribute("aria-pressed")).toBe("true");

  await user.click(within(classGroup).getByRole("button", { name: "Class 10" }));
  await waitFor(() => expect(screen.getByTestId("selection").textContent).toContain('"stageKey":"cambridge_igcse_y11"'));
  expect(screen.getByText("IGCSE · Year 11")).toBeTruthy();

  await user.click(within(boardGroup).getByRole("button", { name: "CBSE" }));
  await waitFor(() => expect(screen.getByTestId("selection").textContent).toContain('"stageKey":"cbse_10"'));
  expect(within(classGroup).getByRole("button", { name: "Class 10" }).getAttribute("aria-pressed")).toBe("true");

  expect(await screen.findByRole("button", { name: /Mathematics/ })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("subject search opens inline from the Subjects heading and IB levels remain explicit", async () => {
  const user = userEvent.setup();
  render(<Harness initial={{
    providerKey: "ib",
    programmeKey: "ibdp",
    stageKey: "ibdp_1",
    subjects: [],
  }} />);

  const searchToggle = screen.getByRole("button", { name: "Search subjects" });
  await user.click(searchToggle);
  const search = screen.getByRole("textbox", { name: "Search subjects" });
  await user.type(search, "phys");

  expect(screen.queryByRole("button", { name: /Mathematics/ })).toBeNull();
  const physics = await screen.findByRole("button", { name: /Physics/ });
  await user.click(physics);

  const levelGroup = screen.getByRole("group", { name: "Physics level" });
  expect(within(levelGroup).getAllByRole("button")).toHaveLength(2);
  await user.click(within(levelGroup).getByRole("button", { name: "HL" }));

  await waitFor(() => expect(screen.getByTestId("selection").textContent).toContain('["Physics","HL"]'));
  expect(screen.queryByRole("dialog")).toBeNull();
});
