import MathText from "./MathText";

/*
 * A worked answer should read like working, not like a model transcript.
 *
 * The pipeline already writes the substance. This component only restores
 * structure that older one-line answers lost in storage: explicit newlines win;
 * otherwise a math-heavy method with several sentences is broken into numbered
 * steps. Prose answers stay as short paragraphs, so a history or biology answer
 * is not falsely presented as an algorithm.
 */
function chunksFor(text: string): string[] {
  const explicit = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;

  const sentences = text
    .split(/(?<=[.!?])\s+(?=(?:[A-Z0-9]|\\|\$))/)
    .map((part) => part.trim())
    .filter(Boolean);
  return sentences.length >= 3 ? sentences : explicit;
}

function isMathHeavy(text: string): boolean {
  const signals = text.match(
    /(?:\\\(|\\\[|\$\$?|\b(?:lambda|mu|sigma|theta|pi|ln|log|sqrt)\b|[λμσθπ]|[=^<>≤≥≈]|\d\s*[+\-*/×÷]\s*\d)/gi,
  );
  return (signals?.length ?? 0) >= 2;
}

export default function WorkedAnswer({ text }: { text: string }) {
  const chunks = chunksFor(text);
  if (chunks.length <= 1) return <MathText text={text} />;

  if (isMathHeavy(text)) {
    return (
      <ol className="worked-steps" aria-label="Worked solution steps">
        {chunks.map((chunk, index) => (
          <li key={index}><MathText text={chunk} /></li>
        ))}
      </ol>
    );
  }

  return (
    <div className="worked-paragraphs">
      {chunks.map((chunk, index) => (
        <p key={index}><MathText text={chunk} /></p>
      ))}
    </div>
  );
}
