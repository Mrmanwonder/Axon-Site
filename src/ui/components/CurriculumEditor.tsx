import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { hapticTick } from "../lib/haptics";
import {
  PROVIDER_KEYS,
  defaultLevelFor,
  filterSubjectOfferings,
  getProgrammes,
  getStages,
  getSubjectOfferings,
  providerLabel,
} from "../data/modules";
import type {
  CurriculumProgramme,
  CurriculumStage,
  SubjectOffering,
} from "../data/modules";
import "./CurriculumEditor.css";

export type CurriculumSubjectChoice = {
  offering: SubjectOffering;
  level: "SL" | "HL" | null;
};

export type CurriculumSelection = {
  providerKey: "cambridge" | "cbse" | "ib" | "";
  programmeKey: string;
  stageKey: string;
  subjects: CurriculumSubjectChoice[];
};

type StageChoice = {
  programme: CurriculumProgramme;
  stage: CurriculumStage;
};

const CLASS_LEVELS = [9, 10, 11, 12] as const;
const BOARD_LABELS: Record<Exclude<CurriculumSelection["providerKey"], "">, string> = {
  cambridge: "Cambridge",
  cbse: "CBSE",
  ib: "IBDP",
};

function inferredClass(stage: CurriculumStage) {
  if (stage.legacy_class_level) return stage.legacy_class_level;
  const key = stage.key.toLowerCase();
  if (/(_9|y10|dp1)$/.test(key)) return key.includes("dp1") ? 11 : 9;
  if (/(_10|y11)$/.test(key)) return 10;
  if (/(_11|_as|dp1)$/.test(key)) return 11;
  if (/(_12|a_level|dp2)$/.test(key)) return 12;
  return null;
}

function stageSummary(choice: StageChoice | null) {
  if (!choice) return "Choose a class";
  const { stage } = choice;
  if (stage.school_year_label && !stage.label.includes(stage.school_year_label)) {
    return `${stage.label} · ${stage.school_year_label}`;
  }
  return stage.label;
}

function programmeSummary(choice: StageChoice | null) {
  if (!choice) return "Choose a curriculum";
  switch (choice.programme.key) {
    case "cambridge_igcse": return "IGCSE";
    case "cambridge_as": return "AS Level";
    case "cambridge_a_level": return "A Level";
    case "cbse_secondary": return "Secondary";
    case "cbse_senior_secondary": return "Senior Secondary";
    case "ibdp": return "Diploma Programme";
    default: return choice.programme.label;
  }
}

function subjectSecondary(offering: SubjectOffering) {
  return offering.external_code ?? "";
}

export function curriculumSelectionIsComplete(selection: CurriculumSelection) {
  if (!selection.providerKey || !selection.programmeKey || !selection.stageKey || !selection.subjects.length) return false;
  return selection.subjects.every(({ offering, level }) => {
    const levels = offering.levels_supported ?? [];
    return !levels.length || (!!level && levels.includes(level));
  });
}

function StageIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m3.5 8.5 8.5-4.2 8.5 4.2-8.5 4.2-8.5-4.2Z" />
    <path d="M7.5 10.6v4.7c2.5 2.2 6.5 2.2 9 0v-4.7" />
    <path d="M20.5 8.7v5.4" />
  </svg>;
}

function BoardIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3.8h7l4 4V20H7z" />
    <path d="M14 3.8V8h4" />
  </svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.8" cy="10.8" r="6.2" />
    <path d="m15.4 15.4 4.2 4.2" />
  </svg>;
}

export default function CurriculumEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: CurriculumSelection;
  onChange: (next: CurriculumSelection) => void;
  disabled?: boolean;
}) {
  const [stageChoices, setStageChoices] = useState<StageChoice[]>([]);
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [preferredClass, setPreferredClass] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value.providerKey) {
      setStageChoices([]);
      return;
    }
    setStageChoices([]);
    setLoadingStages(true);
    setCatalogError(null);
    (async () => {
      const programmes = await getProgrammes(value.providerKey);
      const stages = await Promise.all(programmes.map(async programme => ({
        programme,
        stages: await getStages(programme.key),
      })));
      if (cancelled) return;
      setStageChoices(stages.flatMap(({ programme, stages: rows }) =>
        rows.map(stage => ({ programme, stage }))
      ));
    })().catch(() => {
      if (!cancelled) setCatalogError("The curriculum catalog could not be loaded.");
    }).finally(() => { if (!cancelled) setLoadingStages(false); });
    return () => { cancelled = true; };
  }, [value.providerKey]);

  const selectedStage = useMemo(() => stageChoices.find(choice =>
    choice.programme.key === value.programmeKey && choice.stage.key === value.stageKey
  ) ?? null, [stageChoices, value.programmeKey, value.stageKey]);

  const stageByClass = useMemo(() => {
    const map = new Map<number, StageChoice>();
    for (const choice of stageChoices) {
      const classLevel = inferredClass(choice.stage);
      if (classLevel && !map.has(classLevel)) map.set(classLevel, choice);
    }
    return map;
  }, [stageChoices]);

  useEffect(() => {
    if (!value.providerKey || loadingStages || !stageChoices.length) return;
    const selectedClass = selectedStage ? inferredClass(selectedStage.stage) : null;

    // Existing profiles keep their stored class when the editor first loads.
    // New onboarding profiles have no selected stage, so Class 11 is the
    // intentional starting point shown in the design.
    if (selectedClass && preferredClass == null) {
      setPreferredClass(selectedClass);
      return;
    }

    const targetClass = preferredClass ?? 11;
    if (selectedClass === targetClass) return;

    const exact = stageByClass.get(targetClass);
    const fallback = exact ?? [...stageChoices]
      .sort((a, b) => Math.abs((inferredClass(a.stage) ?? 99) - targetClass)
        - Math.abs((inferredClass(b.stage) ?? 99) - targetClass))[0];
    if (!fallback) return;
    const nextClass = inferredClass(fallback.stage);
    if (nextClass && nextClass !== preferredClass) setPreferredClass(nextClass);
    onChange({
      ...value,
      programmeKey: fallback.programme.key,
      stageKey: fallback.stage.key,
      subjects: [],
    });
  }, [
    loadingStages, onChange, preferredClass, selectedStage, stageByClass,
    stageChoices, value,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!value.programmeKey || !value.stageKey) {
      setOfferings([]);
      return;
    }
    setLoadingSubjects(true);
    setCatalogError(null);
    getSubjectOfferings({ programmeKey: value.programmeKey, stageKey: value.stageKey })
      .then(rows => { if (!cancelled) setOfferings(rows); })
      .catch(() => { if (!cancelled) setCatalogError("Subjects could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingSubjects(false); });
    return () => { cancelled = true; };
  }, [value.programmeKey, value.stageKey]);

  const selectedIds = useMemo(() => new Set(value.subjects.map(item => item.offering.id)), [value.subjects]);
  const selectedById = useMemo(() => new Map(value.subjects.map(item => [item.offering.id, item])), [value.subjects]);
  const shownOfferings = useMemo(() => filterSubjectOfferings(offerings, query), [offerings, query]);

  const activeClass = selectedStage ? inferredClass(selectedStage.stage) ?? preferredClass ?? 11 : preferredClass ?? 11;
  const classIndex = Math.max(0, CLASS_LEVELS.indexOf(activeClass as typeof CLASS_LEVELS[number]));
  const boardIndex = Math.max(0, PROVIDER_KEYS.indexOf(value.providerKey || "cambridge"));

  const chooseProvider = (providerKey: "cambridge" | "cbse" | "ib") => {
    if (disabled || providerKey === value.providerKey) return;
    hapticTick();
    const currentClass = preferredClass ?? activeClass ?? 11;
    const nextClass = providerKey === "ib" && currentClass < 11 ? 11 : currentClass;
    setPreferredClass(nextClass);
    setStageChoices([]);
    setOfferings([]);
    setQuery("");
    setSearchOpen(false);
    onChange({ providerKey, programmeKey: "", stageKey: "", subjects: [] });
  };

  const chooseClass = (classLevel: number) => {
    if (disabled) return;
    const choice = stageByClass.get(classLevel);
    if (!choice) return;
    hapticTick();
    setPreferredClass(classLevel);
    if (choice.programme.key === value.programmeKey && choice.stage.key === value.stageKey) return;
    onChange({
      ...value,
      programmeKey: choice.programme.key,
      stageKey: choice.stage.key,
      subjects: [],
    });
  };

  const toggleSubject = (offering: SubjectOffering) => {
    if (disabled) return;
    hapticTick();
    if (selectedIds.has(offering.id)) {
      onChange({ ...value, subjects: value.subjects.filter(item => item.offering.id !== offering.id) });
      return;
    }
    onChange({
      ...value,
      subjects: [...value.subjects, { offering, level: defaultLevelFor(offering) }],
    });
  };

  const setLevel = (offeringId: string, level: "SL" | "HL") => {
    if (disabled) return;
    hapticTick();
    onChange({
      ...value,
      subjects: value.subjects.map(item => item.offering.id === offeringId ? { ...item, level } : item),
    });
  };

  return <div className="curriculum-editor">
    <div className="sectitle curriculum-stage-title">Stage</div>
    <div className="curriculum-stage-card">
      <div className="curriculum-stage-card-row">
        <span className="curriculum-row-icon"><StageIcon /></span>
        <span className="curriculum-row-copy">
          <b>Class</b>
          <small>{loadingStages ? "Loading…" : stageSummary(selectedStage)}</small>
        </span>
        <div
          className="curriculum-class-selector"
          role="group"
          aria-label="Class"
          style={{ "--active-index": classIndex } as CSSProperties}
        >
          <span className="curriculum-selector-glider" aria-hidden="true" />
          {CLASS_LEVELS.map(classLevel => {
            const available = !value.providerKey || loadingStages || stageByClass.has(classLevel);
            return <button
              key={classLevel}
              type="button"
              aria-label={`Class ${classLevel}`}
              aria-pressed={selectedStage ? inferredClass(selectedStage.stage) === classLevel : false}
              disabled={disabled || !available}
              onClick={() => chooseClass(classLevel)}
            >
              {classLevel}
            </button>;
          })}
        </div>
      </div>

      <div className="curriculum-stage-divider" />

      <div className="curriculum-stage-card-row">
        <span className="curriculum-row-icon"><BoardIcon /></span>
        <span className="curriculum-row-copy">
          <b>Board</b>
          <small>{loadingStages ? "Loading…" : programmeSummary(selectedStage)}</small>
        </span>
        <div
          className="curriculum-board-selector"
          role="group"
          aria-label="Board"
          style={{ "--active-index": boardIndex } as CSSProperties}
        >
          <span className="curriculum-selector-glider" aria-hidden="true" />
          {PROVIDER_KEYS.map(key => (
            <button
              key={key}
              type="button"
              aria-label={providerLabel(key)}
              aria-pressed={value.providerKey === key}
              disabled={disabled}
              onClick={() => chooseProvider(key)}
            >
              {BOARD_LABELS[key]}
            </button>
          ))}
        </div>
      </div>
    </div>

    <div className="curriculum-subject-heading">
      <div className="sectitle">Subjects</div>
      <button
        type="button"
        className={"curriculum-search-toggle" + (searchOpen ? " on" : "")}
        aria-label="Search subjects"
        aria-expanded={searchOpen}
        disabled={disabled || !value.stageKey}
        onClick={() => {
          hapticTick();
          setSearchOpen(open => !open);
          if (searchOpen) setQuery("");
        }}
      >
        <SearchIcon />
      </button>
    </div>

    {searchOpen && <div className="curriculum-inline-search">
      <SearchIcon />
      <input
        aria-label="Search subjects"
        value={query}
        autoFocus
        autoComplete="off"
        placeholder="Subject name or code"
        onChange={event => setQuery(event.target.value)}
      />
      {query && <button type="button" aria-label="Clear subject search" onClick={() => setQuery("")}>×</button>}
    </div>}

    <div className="curriculum-chip-grid" aria-live="polite">
      {!value.stageKey && <div className="curriculum-empty">Choose a board and class to see subjects.</div>}
      {value.stageKey && loadingSubjects && <div className="curriculum-empty">Loading subjects…</div>}
      {value.stageKey && !loadingSubjects && shownOfferings.map(offering => {
        const selected = selectedIds.has(offering.id);
        const choice = selectedById.get(offering.id);
        return <div className={"curriculum-chip-wrap" + (selected ? " selected" : "")} key={offering.id}>
          <button
            type="button"
            className={"curriculum-subject-chip" + (selected ? " on" : "")}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggleSubject(offering)}
          >
            <span>{offering.display_name}</span>
            {subjectSecondary(offering) && <small>{subjectSecondary(offering)}</small>}
          </button>
          {selected && (offering.levels_supported?.length ?? 0) > 1 && (
            <div className="curriculum-chip-levels" role="group" aria-label={`${offering.display_name} level`}>
              {offering.levels_supported.map(level => (
                <button
                  type="button"
                  key={level}
                  className={choice?.level === level ? "on" : ""}
                  aria-pressed={choice?.level === level}
                  onClick={() => setLevel(offering.id, level)}
                >
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>;
      })}
      {value.stageKey && !loadingSubjects && !shownOfferings.length && (
        <div className="curriculum-empty">No matching subjects.</div>
      )}
    </div>

    {catalogError && <div className="curriculum-error" role="alert">{catalogError}</div>}
  </div>;
}
