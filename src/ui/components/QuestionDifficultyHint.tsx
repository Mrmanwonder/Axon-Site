import { useEffect, useState } from "react";
import { readQuestionDifficulty } from "../data/modules";
import type { DifficultyEvidence } from "../data/questionDifficulty";
import { questionDifficultyLabel, SOURCE_LABEL } from "../data/questionDifficulty";

/** A question label is evidence, never an official judgement without source. */
export default function QuestionDifficultyHint({ attemptId }: { attemptId: string }) {
  const [value, setValue] = useState<DifficultyEvidence | null>(null);
  useEffect(() => {
    let alive = true;
    setValue(null);
    readQuestionDifficulty(attemptId)
      .then(result => { if (alive) setValue(result); })
      .catch(() => { if (alive) setValue(null); });
    return () => { alive = false; };
  }, [attemptId]);

  if (!value) return null; // ungrounded or unavailable estimate is never manufactured
  const low = value.confidence < .6;
  return <div className="qfield">
    <div className="k">Question difficulty</div>
    <div className="v" style={{ fontSize: 13.5 }}>
      {questionDifficultyLabel(value)}
      <span style={{ marginLeft: 8, color: "var(--label-2)", fontSize: 12 }}>
        {low ? "Low confidence" : SOURCE_LABEL[value.source] ?? "Evidence-based estimate"}
      </span>
    </div>
    <div className="subnote" style={{ marginTop: 4 }}>
      {SOURCE_LABEL[value.source] ?? "Difficulty estimate"} · method {value.method_version}.
      This describes the question, not your ability or your teacher's mark.
    </div>
  </div>;
}
