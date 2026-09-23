import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "./Dialog";
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
  label: string;
};

function stageChoiceLabel(providerKey: string, programme: CurriculumProgramme, stage: CurriculumStage) {
  if (providerKey === "cambridge") {
    if (programme.key === "cambridge_igcse") {
      return stage.school_year_label ? `IGCSE · ${stage.school_year_label}` : "IGCSE";
    }
    return programme.key === "cambridge_as" ? "AS Level" : "A Level";
  }
  if (providerKey === "ib") return stage.label;
  return stage.label;
}

function subjectSecondary(offering: SubjectOffering) {
  const bits = [
    offering.external_code,
    typeof offering.metadata?.group === "string" ? offering.metadata.group : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function curriculumSelectionIsComplete(selection: CurriculumSelection) {
  if (!selection.providerKey || !selection.programmeKey || !selection.stageKey || !selection.subjects.length) return false;
  return selection.subjects.every(({ offering, level }) => {
    const levels = offering.levels_supported ?? [];
    return !levels.length || (!!level && levels.includes(level));
  });
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value.providerKey) {
      setStageChoices([]);
      return;
    }
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
        rows.map(stage => ({
          programme,
          stage,
          label: stageChoiceLabel(value.providerKey, programme, stage),
        }))
      ));
    })().catch(() => {
      if (!cancelled) setCatalogError("The curriculum catalog could not be loaded.");
    }).finally(() => { if (!cancelled) setLoadingStages(false); });
    return () => { cancelled = true; };
  }, [value.providerKey]);

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
  const shownOfferings = useMemo(() => {
    const filtered = filterSubjectOfferings(offerings, query);
    return [...filtered].sort((a, b) => {
      const selectedDelta = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
      return selectedDelta || a.display_name.localeCompare(b.display_name);
    });
  }, [offerings, query, selectedIds]);

  const chooseProvider = (providerKey: "cambridge" | "cbse" | "ib") => {
    if (disabled || providerKey === value.providerKey) return;
    hapticTick();
    onChange({ providerKey, programmeKey: "", stageKey: "", subjects: [] });
  };

  const chooseStage = (choice: StageChoice) => {
    if (disabled || (choice.programme.key === value.programmeKey && choice.stage.key === value.stageKey)) return;
    hapticTick();
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
    hapticTick();
    onChange({
      ...value,
      subjects: value.subjects.map(item => item.offering.id === offeringId ? { ...item, level } : item),
    });
  };

  return <div className="curriculum-editor">
    <div className="sectitle">Curriculum</div>
    <div className="curriculum-choice-row" role="group" aria-label="Curriculum">
      {PROVIDER_KEYS.map(key => (
        <button
          key={key}
          type="button"
          className={"curriculum-choice" + (value.providerKey === key ? " on" : "")}
          aria-pressed={value.providerKey === key}
          disabled={disabled}
          onClick={() => chooseProvider(key)}
        >
          {providerLabel(key)}
        </button>
      ))}
    </div>

    <div className="sectitle">Stage</div>
    <div className="curriculum-stage-row" role="group" aria-label="Stage">
      {!value.providerKey && <div className="curriculum-empty">Choose a curriculum first.</div>}
      {value.providerKey && loadingStages && <div className="curriculum-empty">Loading stages…</div>}
      {value.providerKey && !loadingStages && stageChoices.map(choice => {
        const on = choice.programme.key === value.programmeKey && choice.stage.key === value.stageKey;
        return <button
          key={choice.stage.id}
          type="button"
          className={"curriculum-stage" + (on ? " on" : "")}
          aria-pressed={on}
          disabled={disabled}
          onClick={() => chooseStage(choice)}
        >
          {choice.label}
        </button>;
      })}
    </div>

    <div className="sectitle">Subjects</div>
    <div className="curriculum-selected" aria-live="polite">
      {value.subjects.map(({ offering, level }) => (
        <div className="curriculum-subject" key={offering.id}>
          <div className="curriculum-subject-copy">
            <b>{offering.display_name}</b>
            {subjectSecondary(offering) && <small>{subjectSecondary(offering)}</small>}
          </div>
          {!!offering.levels_supported?.length && (
            <div className="seg curriculum-level" role="group" aria-label={`${offering.display_name} level`}>
              {offering.levels_supported.map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  className={level === candidate ? "on" : undefined}
                  aria-pressed={level === candidate}
                  disabled={disabled}
                  onClick={() => setLevel(offering.id, candidate)}
                >
                  {candidate}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="curriculum-remove"
            aria-label={`Remove ${offering.display_name}`}
            disabled={disabled}
            onClick={() => toggleSubject(offering)}
          >
            ×
          </button>
        </div>
      ))}
      {!value.subjects.length && (
        <div className="curriculum-empty">
          {value.stageKey ? "No subjects selected yet." : "Choose a stage to see its subjects."}
        </div>
      )}
      <button
        ref={addButtonRef}
        type="button"
        className="curriculum-add"
        disabled={disabled || !value.stageKey || loadingSubjects}
        onClick={() => { hapticTick(); setQuery(""); setPickerOpen(true); }}
      >
        {loadingSubjects ? "Loading subjects…" : "+ Add subjects"}
      </button>
    </div>

    {catalogError && <div className="curriculum-error" role="alert">{catalogError}</div>}

    {pickerOpen && <Dialog
      title="Add subjects"
      description="Search the official catalog for the curriculum and stage you selected."
      onClose={() => setPickerOpen(false)}
      restoreFocus={addButtonRef.current}
    >
      <div className="curriculum-search">
        <label htmlFor="curriculum-subject-search">Search</label>
        <input
          id="curriculum-subject-search"
          value={query}
          autoComplete="off"
          placeholder="Subject name or code"
          onChange={event => setQuery(event.target.value)}
        />
      </div>
      <div className="curriculum-results" role="list">
        {shownOfferings.map(offering => {
          const selected = selectedIds.has(offering.id);
          return <button
            key={offering.id}
            type="button"
            role="listitem"
            className={"curriculum-result" + (selected ? " on" : "")}
            aria-pressed={selected}
            onClick={() => toggleSubject(offering)}
          >
            <span>
              <b>{offering.display_name}</b>
              {subjectSecondary(offering) && <small>{subjectSecondary(offering)}</small>}
            </span>
            <span className="curriculum-result-state" aria-hidden="true">{selected ? "✓" : "+"}</span>
          </button>;
        })}
        {!shownOfferings.length && <div className="curriculum-no-results">No matching subjects.</div>}
      </div>
      <div className="acts">
        <button type="button" className="btn primary" onClick={() => setPickerOpen(false)}>Done</button>
      </div>
    </Dialog>}
  </div>;
}
