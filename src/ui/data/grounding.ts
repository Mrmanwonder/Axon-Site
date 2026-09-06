/**
 * What the screen says when the pipeline could not ground what it wrote.
 *
 * One module because these are the app's most load-bearing sentences and they
 * need to be read together. Every one of them is written against three rules:
 *
 *   Never expose internal terminology. `heuristic_off_topic` is a field name,
 *   not something to show a fifteen-year-old.
 *
 *   Never ask the student to judge output we could not verify. A line that says
 *   "this may be inaccurate" moves our failure onto the person least able to
 *   catch it, which is the whole reason the working is withheld rather than
 *   disclaimed.
 *
 *   Say what happened, and where they can act, say that too. A gap with no
 *   account of itself is a content hole the student has to interpret; hard
 *   rule 4 says an admitted gap is recoverable and an invisible one is not,
 *   and that applies to a missing explanation as much as to a missing crop.
 */

export type GroundingStatus =
  | "complete"
  | "missing_dependency"
  | "missing_question_text"
  | "no_verified_answer_source"
  | "heuristic_off_topic"
  | "generation_failed";

export interface WithheldCopy {
  /** What to say where the worked answer would have been. */
  note: string;
  /** Whether the student can do something about it, which earns a CTA. */
  actionable: boolean;
}

/**
 * Why there is no worked answer, in the student's own terms.
 *
 * `complete` returns null: either a working is being shown, or the model
 * honestly declined to write one on a question it could not work through, and
 * that second case is the outcome the prompt asks for rather than a failure to
 * report. Every other value is a real absence with a real cause.
 */
export function withheldWorking(
  status: GroundingStatus | null | undefined,
  unresolvedParts: string[] | null | undefined,
): WithheldCopy | null {
  switch (status) {
    case "missing_dependency": {
      // The only one the student can act on: a page is missing from the scan.
      const parts = unresolvedParts?.length ? unresolvedParts.join(" and ") : null;
      return {
        note: parts
          ? `This question builds on part ${parts}, which isn’t in this scan. Add that page and Axon can work it through.`
          : "This question builds on an earlier part that isn’t in this scan. Add that page and Axon can work it through.",
        actionable: true,
      };
    }
    case "missing_question_text":
      return {
        note: "Not enough of this question could be read to work through it. The crop above is what Axon had.",
        actionable: false,
      };
    case "heuristic_off_topic":
      return {
        note: "No worked answer here — Axon couldn’t tie one to this question closely enough to be worth your time.",
        actionable: false,
      };
    case "no_verified_answer_source":
      return {
        note: "No worked answer here. Axon couldn’t confirm what it would be based on.",
        actionable: false,
      };
    case "generation_failed":
      return {
        note: "Axon couldn’t write a worked answer for this one.",
        actionable: false,
      };
    default:
      return null;
  }
}

/**
 * How much the diagnosis below is entitled to claim.
 *
 * The corrected working and the diagnosis come out of the same call, on the
 * same evidence. When that evidence was incomplete, the diagnosis was written
 * on it too — so a card that withholds the working and then presents the
 * diagnosis under "Why marks were lost", in the same type as everything else,
 * is asserting a grounding it just admitted it did not have.
 *
 * The heading changes rather than the content disappearing. What the model
 * noticed about the command word is genuinely useful — reading "Explain" as
 * "State" is one of the most fixable ways a Cambridge mark goes — it is simply
 * not the same claim as "here is the subject knowledge you were missing", and
 * it should not be dressed as one.
 */
export function diagnosisHeading(status: GroundingStatus | null | undefined): string {
  return status === "complete" ? "Why marks were lost" : "What Axon noticed";
}

/**
 * One line under an ungrounded diagnosis, saying what it was written from.
 *
 * Null when the grounding was complete: a grounded diagnosis needs no caveat,
 * and adding one everywhere would train students to stop reading them.
 */
export function diagnosisNote(
  status: GroundingStatus | null | undefined,
  unresolvedParts: string[] | null | undefined,
): string | null {
  if (!status || status === "complete") return null;
  if (status === "missing_dependency") {
    const parts = unresolvedParts?.length ? ` (${unresolvedParts.join(", ")})` : "";
    return `Axon can see what this question asked for, but not the earlier part${parts} it builds on — so this is about how the answer was written, not about the topic itself.`;
  }
  return "This is about what the question asked for and how the answer was written, rather than the topic itself.";
}
