/* ═══════════════════════════════════════════════════════════════════════════
   THE PRINTED COMMAND WORD

   The same deterministic reading as `private.printed_command_word` in SQL
   (migration 20261013090000), so Insights and the practice scorecard agree on
   every question. Both are tied by tests/fixtures/printed-command-words.json,
   which the database test and the UI test each run.

   Why printed and not the explain stage's tag: the explain stage only runs on
   parts that lost marks, so its command word exists only on lost parts. A
   success rate built on it has no full-mark parts in the denominator and is
   biased toward "you lose marks on this word". The printed word is read from
   every question, lost or not, so its rate is honest.

   It refuses to guess: two different command words in one part, or none at a
   sentence start, gives null.
   ═══════════════════════════════════════════════════════════════════════════ */

const WORDS = [
  "Show that", "Show your working", "Write down", "Work out", "Comment on", "How far", "To what extent",
  "Advise", "Analyse", "Annotate", "Argue", "Assess", "Calculate", "Comment", "Compare", "Consider",
  "Contrast", "Deduce", "Define", "Describe", "Design", "Determine", "Develop", "Devise", "Discuss",
  "Estimate", "Evaluate", "Experiment", "Explain", "Explore", "Find", "Give", "Hence", "Identify",
  "Infer", "Justify", "Locate", "Outline", "Plan", "Predict", "Prove", "Refine", "Reflect", "Sketch",
  "State", "Suggest", "Summarise", "Test", "Trace", "Verify", "Write",
];
const HENCE_WORDS = ["show that", "write down", "work out", "find", "deduce", "determine", "calculate",
  "sketch", "prove", "state", "explain", "verify", "estimate", "give", "suggest"];

const START = String.raw`(?:^|[.?!;:]\s+|\n\s*)`;
const WORD_RE = new RegExp(`${START}(${WORDS.join("|")})\\b`, "g");
const HENCE_RE = new RegExp(`${START}Hence,?\\s+(?:or otherwise,?\\s+)?(${HENCE_WORDS.join("|")})\\b`, "g");
const HENCE_ALONE = new RegExp(`${START}Hence\\b`);

const initcap = (s: string) => s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

export function printedCommandWord(text: string | null | undefined): string | null {
  if (text == null || !text.trim().length) return null;
  let t = text.replace(/^\s*(\(?[0-9]{1,2}\)?|\([a-z]{1,4}\)|[a-z]{1,4}\))(\s*(\([a-z]{1,4}\)|\([0-9]{1,2}\)))*\s*/, "");
  t = t.replace(/\[\s*[0-9]+\s*\]/g, " ");
  const found = new Set<string>();
  for (const m of t.matchAll(WORD_RE)) {
    const canon = m[1] === "How far" || m[1] === "To what extent" ? "How far / To what extent" : m[1];
    if (canon !== "Show your working" && canon !== "Hence") found.add(canon);
  }
  for (const m of t.matchAll(HENCE_RE)) {
    const w = m[1].toLowerCase();
    found.add(w === "show that" ? "Show that" : w === "write down" ? "Write down" : w === "work out" ? "Work out" : initcap(w));
  }
  if (found.size === 0) return HENCE_ALONE.test(t) ? "Hence" : null;
  return found.size === 1 ? [...found][0] : null;
}
