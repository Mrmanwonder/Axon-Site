import { useEffect, useMemo, useState } from "react";
import {
  CURRICULUM_PROVIDERS, CURRICULUM_PROGRAMMES, CURRICULUM_STAGE_OPTIONS,
  getSubjectOfferings, filterSubjectOfferings,
} from "../data/modules";
import type {
  CurriculumProviderKey, CurriculumOffering, SubjectSelection,
} from "../data/modules";
import { hapticTick } from "../lib/haptics";

export type EditableSubject = SubjectSelection & {
  levels_supported?: ("SL" | "HL")[];
  group?: string | null;
};

type Props = {
  providerKey: CurriculumProviderKey;
  programmeKey: string;
  stageKey: string;
  subjects: EditableSubject[];
  onIdentityChange: (next: {
    providerKey: CurriculumProviderKey;
    programmeKey: string;
    stageKey: string;
  }) => void;
  onSubjectsChange: (subjects: EditableSubject[]) => void;
};

function stageChoices(providerKey: CurriculumProviderKey) {
  return (CURRICULUM_PROGRAMMES[providerKey] ?? []).flatMap((programme) =>
    (CURRICULUM_STAGE_OPTIONS[programme.key] ?? []).map((stage) => ({
      ...stage,
      programmeKey: programme.key,
    })),
  );
}

export default function CurriculumProfileFields({
  providerKey, programmeKey, stageKey, subjects, onIdentityChange, onSubjectsChange,
}: Props) {
  const [offerings, setOfferings] = useState<CurriculumOffering[]>([]);
  const [catalogueState, setCatalogueState] = useState<"loading" | "ready" | "failed">("loading");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [query, setQuery] = useState("");

  const stages = useMemo(() => stageChoices(providerKey), [providerKey]);

  useEffect(() => {
    let active = true;
    setCatalogueState("loading");
    getSubjectOfferings({ programmeKey, stageKey })
      .then((rows) => {
        if (!active) return;
        setOfferings(rows);
        setCatalogueState("ready");
      })
      .catch(() => {
        if (!active) return;
        setOfferings([]);
        setCatalogueState("failed");
      });
    return () => { active = false; };
  }, [programmeKey, stageKey]);

  const visible = useMemo(
    () => filterSubjectOfferings(offerings, query).slice(0, 120),
    [offerings, query],
  );
  const selectedIds = useMemo(() => new Set(subjects.map((s) => s.offering_id)), [subjects]);

  const switchProvider = (key: CurriculumProviderKey) => {
    const programme = CURRICULUM_PROGRAMMES[key]?.[0];
    const stage = programme ? CURRICULUM_STAGE_OPTIONS[programme.key]?.[0] : null;
    if (!programme || !stage) return;
    hapticTick();
    onIdentityChange({ providerKey: key, programmeKey: programme.key, stageKey: stage.key });
    onSubjectsChange([]);
  };

  const switchStage = (next: { key: string; programmeKey: string }) => {
    if (next.key === stageKey && next.programmeKey === programmeKey) return;
    hapticTick();
    onIdentityChange({ providerKey, programmeKey: next.programmeKey, stageKey: next.key });
    onSubjectsChange([]);
  };

  const addOffering = (offering: CurriculumOffering) => {
    if (selectedIds.has(offering.id)) return;
    const level = offering.levelsSupported.length === 1 ? offering.levelsSupported[0] : null;
    onSubjectsChange([...subjects, {
      offering_id: offering.id,
      subject: offering.displayName,
      external_code: offering.externalCode,
      level,
      levels_supported: offering.levelsSupported,
      group: offering.group,
    }]);
    hapticTick();
  };

  const remove = (offeringId: string) => {
    hapticTick();
    onSubjectsChange(subjects.filter((s) => s.offering_id !== offeringId));
  };

  const setLevel = (offeringId: string, level: "SL" | "HL") => {
    hapticTick();
    onSubjectsChange(subjects.map((s) => s.offering_id === offeringId ? { ...s, level } : s));
  };

  return (
    <>
      <div className="sectitle">Curriculum</div>
      <div className="curriculum-provider-grid" role="group" aria-label="Curriculum">
        {CURRICULUM_PROVIDERS.map((provider) => (
          <button
            key={provider.key}
            type="button"
            className={"curriculum-choice" + (provider.key === providerKey ? " on" : "")}
            aria-pressed={provider.key === providerKey}
            onClick={() => switchProvider(provider.key)}
          >
            {provider.label}
          </button>
        ))}
      </div>

      <div className="sectitle">Stage</div>
      <div className="curriculum-stage-grid" role="group" aria-label="Stage">
        {stages.map((stage) => (
          <button
            key={stage.key}
            type="button"
            className={"curriculum-choice" + (stage.key === stageKey ? " on" : "")}
            aria-pressed={stage.key === stageKey}
            onClick={() => switchStage(stage)}
          >
            {stage.label}
          </button>
        ))}
      </div>

      <div className="sectitle">Subjects</div>
      <div className="selected-subjects" aria-live="polite">
        {subjects.map((subject) => (
          <div className="selected-subject" key={subject.offering_id}>
            <div className="selected-subject-copy">
              <strong>{subject.subject}</strong>
              {subject.external_code && <small>{subject.external_code}</small>}
            </div>
            {(subject.levels_supported?.length ?? 0) > 0 && (
              <div className="seg compact" role="group" aria-label={`${subject.subject} level`}>
                {subject.levels_supported!.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={subject.level === level ? "on" : undefined}
                    aria-pressed={subject.level === level}
                    onClick={() => setLevel(subject.offering_id, level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
            <button
              className="subject-remove"
              type="button"
              aria-label={`Remove ${subject.subject}`}
              onClick={() => remove(subject.offering_id)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-subjects"
          disabled={catalogueState === "failed"}
          onClick={() => { setQuery(""); setBrowserOpen(true); }}
        >
          {catalogueState === "loading" ? "Loading subjects…" : "+ Add subjects"}
        </button>
      </div>

      {catalogueState === "failed" && (
        <div className="note">The subject catalog could not be loaded. Check the connection and try again.</div>
      )}

      {browserOpen && (
        <div className="curriculum-sheet-backdrop" role="presentation" onMouseDown={() => setBrowserOpen(false)}>
          <section
            className="curriculum-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Add subjects"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="curriculum-sheet-head">
              <div>
                <div className="curriculum-sheet-title">Add subjects</div>
                <div className="curriculum-sheet-sub">Search by subject, code, language or group.</div>
              </div>
              <button type="button" className="sheet-close" aria-label="Close" onClick={() => setBrowserOpen(false)}>×</button>
            </div>
            <input
              className="curriculum-search"
              value={query}
              autoFocus
              placeholder="Search subjects"
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="curriculum-results">
              {visible.map((offering) => {
                const selected = selectedIds.has(offering.id);
                return (
                  <button
                    key={offering.id}
                    type="button"
                    className={"curriculum-result" + (selected ? " selected" : "")}
                    disabled={selected}
                    onClick={() => addOffering(offering)}
                  >
                    <span>
                      <strong>{offering.displayName}</strong>
                      <small>
                        {[offering.externalCode, offering.group, offering.levelsSupported.join(" / ")]
                          .filter(Boolean).join(" · ")}
                      </small>
                    </span>
                    <span className="curriculum-result-action">{selected ? "Added" : "+"}</span>
                  </button>
                );
              })}
              {!visible.length && <div className="curriculum-empty">No matching subjects.</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
