import type { Paper, ProgressRow } from "./modules";
import { paths } from "../app/paths";

type UnreadablePage = { paper_id: string; page_number: number };

/** Counts keep their units. Historical unreadable evidence is not a review task. */
export function homeAttention({
  papers, progress, live, needsCheckCount, unreadable, enoughData,
}: {
  papers: Paper[];
  progress: Map<string, ProgressRow>;
  live: boolean;
  needsCheckCount: number;
  unreadable: UnreadablePage[];
  enoughData: boolean;
}) {
  if (!live) return {
    copy: "Checking your latest evidence…",
    title: null, detail: null, actionLabel: null, destination: null,
  };

  const paperIds = new Set(papers.map(paper => paper.id));
  const runs = [...progress.values()].filter(run => paperIds.has(run.paper_id));
  // Explaining is still system work. It cannot be counted as ready to review.
  const reviewable = runs.filter(run => run.status === "needs_review" || run.status === "ready");
  const processing = runs.filter(run => !["needs_review", "ready", "committed", "failed", "rejected"].includes(run.status));
  const failed = runs.filter(run => run.status === "failed" || run.status === "rejected");
  const pages = unreadable.filter(page => paperIds.has(page.paper_id));
  const noun = (count: number, singular: string) => count + " " + singular + (count === 1 ? "" : "s");

  if (reviewable.length) {
    const first = reviewable[0];
    const needed = Math.max(0, Number(first.questions_needing_you ?? 0));
    return {
      copy: first.status === "ready"
        ? "Your paper is ready to save."
        : needed > 0
          ? noun(needed, "part") + (needed === 1 ? " needs" : " need") + " confirmation on your paper."
          : "Your paper is ready for a final look before saving.",
      title: "Paper review",
      detail: noun(reviewable.length, "paper") + " ready to open",
      actionLabel: first.status === "ready" ? "Open ready paper" : "Open paper review",
      destination: paths.review(first.paper_id),
    };
  }

  if (needsCheckCount > 0) return {
    copy: noun(needsCheckCount, "saved reading") + (needsCheckCount === 1 ? " remains" : " remain") + " uncertain and excluded from Insights.",
    title: "Uncertain saved readings",
    detail: "Inspect the source evidence in Library.",
    actionLabel: "Open Library",
    destination: paths.library,
  };

  if (pages.length) {
    const paper = papers.find(item => item.id === pages[0].paper_id)!;
    const committed = ((paper.student_attempt as { count: number }[] | undefined)?.[0]?.count ?? 0) > 0;
    return {
      copy: noun(pages.length, "saved page") + " could not be read. The source remains available in the affected papers.",
      title: "Unreadable source pages",
      detail: "This is saved source evidence; it does not mean marks are waiting for confirmation.",
      actionLabel: committed ? "Open affected paper" : "Open Library",
      destination: committed ? paths.paper(paper.id) : paths.library,
    };
  }

  if (processing.length) return {
    copy: noun(processing.length, "paper") + (processing.length === 1 ? " is" : " are") + " still being processed. This continues without your input.",
    title: null, detail: null, actionLabel: "View processing", destination: paths.review(processing[0].paper_id),
  };

  if (failed.length) return {
    copy: "Axon could not finish reading " + noun(failed.length, "paper") + ". Open Library for the failure details and available retry.",
    title: "Reading stopped", detail: "A technical failure is separate from mark confirmation.",
    actionLabel: "Open Library", destination: paths.library,
  };

  return {
    copy: enoughData
      ? "Nothing needs you right now. Your latest evidence is ready in Insights."
      : "Nothing needs you right now. Add your next marked paper when you get it back.",
    title: null, detail: null, actionLabel: null, destination: null,
  };
}
