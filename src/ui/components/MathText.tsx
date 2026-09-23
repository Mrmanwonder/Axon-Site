import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/*
 * Student-facing rich text with safe maths.
 *
 * This is the single rendering boundary for prose that can contain mathematics:
 * model explanations, worked answers, OCR fallbacks and teacher text all pass
 * through it. New pipeline output should use \( ... \) for inline maths and
 * \[ ... \] for display maths, but older papers contain ASCII forms such as
 * e^(-lambda*n). Those are upgraded conservatively so a saved paper becomes
 * readable without needing to be reprocessed.
 *
 * Model output, OCR and teacher text are untrusted. KaTeX therefore runs with
 * trust disabled, bounded expansion and throw-on-error. One malformed expression
 * falls back to its source text; it never takes the surrounding explanation down.
 */
const REFUSED = /\\(href|url|includegraphics|html(?:Class|Id|Style|Data)|color|textcolor|colorbox|fcolorbox|mathcolor)\b/;

export function renderSafeLatex(latex: string, displayMode = false): string | null {
  if (!latex.trim() || REFUSED.test(latex)) return null;
  try {
    return katex.renderToString(latex, {
      displayMode,
      strict: true,
      trust: false,
      maxExpand: 1000,
      output: "htmlAndMathml",
      throwOnError: true,
    });
  } catch {
    return null;
  }
}

export function SafeLatex({
  latex,
  display = false,
  className = "",
  fallback,
}: {
  latex: string;
  display?: boolean;
  className?: string;
  fallback?: string | null;
}) {
  const html = useMemo(() => renderSafeLatex(latex, display), [latex, display]);
  if (!html) {
    return (
      <span
        className={["math-raw", className].filter(Boolean).join(" ")}
        title="This expression could not be typeset, so it is shown as received."
      >
        {fallback ?? latex}
      </span>
    );
  }
  return (
    <span
      className={["math-rendered", display ? "math-display" : "", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

const EXPLICIT_MATH = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$(?!\$)(?:\\.|[^$\\\n])+\$)/g;

function looksDelimitedMath(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\\(?:frac|tfrac|dfrac|sqrt|sum|prod|int|lim|log|ln|sin|cos|tan|exp|lambda|mu|sigma|theta|pi|rho|alpha|beta|gamma|delta)\b/.test(text)) {
    return true;
  }
  if (/^[A-Za-z](?:_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}()+\-]+)?$/.test(text)) return true;
  return /[=^_<>~]|[+*\/]|[≤≥≠≈×÷]|\d!/.test(text);
}

function explicitTokens(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(EXPLICIT_MATH)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: "text", value: text.slice(last, index) });

    const raw = match[0];
    const display = raw.startsWith("\\[") || raw.startsWith("$$");
    const value = raw.startsWith("$") && !raw.startsWith("$$")
      ? raw.slice(1, -1)
      : raw.slice(2, -2);

    // Single-dollar delimiters are common model output, but dollars also occur
    // in ordinary prose. Only treat a $...$ pair as maths when the inside looks
    // mathematical; otherwise preserve the exact source text.
    if (raw.startsWith("$") && !raw.startsWith("$$") && !looksDelimitedMath(value)) {
      out.push({ kind: "text", value: raw });
    } else {
      out.push({ kind: "math", value, display });
    }
    last = index + raw.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out.length ? out : [{ kind: "text", value: text }];
}

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-",
};

function normaliseSuperscripts(source: string): string {
  return source.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (run) =>
    "^{" + [...run].map((char) => SUPERSCRIPT[char] ?? char).join("") + "}",
  );
}

function normaliseLegacyLatex(source: string): string {
  let value = normaliseSuperscripts(source.trim());
  value = value
    .replace(/≥/g, "\\ge ")
    .replace(/≤/g, "\\le ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/>=/g, "\\ge ")
    .replace(/<=/g, "\\le ")
    .replace(/!=/g, "\\ne ")
    .replace(/\blambda\b|λ/gi, "\\lambda")
    .replace(/\bmu\b|μ/gi, "\\mu")
    .replace(/\bsigma\b|σ/gi, "\\sigma")
    .replace(/\btheta\b|θ/gi, "\\theta")
    .replace(/\bpi\b|π/gi, "\\pi")
    .replace(/\brho\b|ρ/gi, "\\rho")
    .replace(/\balpha\b|α/gi, "\\alpha")
    .replace(/\bbeta\b|β/gi, "\\beta")
    .replace(/\bgamma\b|γ/gi, "\\gamma")
    .replace(/\bdelta\b|δ/gi, "\\delta")
    .replace(/\b(ln|log|sin|cos|tan|exp)\s*\(/gi, (_m, fn: string) => "\\" + fn.toLowerCase() + "(")
    .replace(/\bsqrt\s*\(([^()]*)\)/gi, "\\sqrt{$1}")
    .replace(/\s*\*\s*/g, " \\cdot ")
    .replace(/\s+~\s+/g, " \\sim ");

  // Common model notation: e^(-lambda*n), x^(n+1), e^-4.58. Keep already
  // braced LaTeX untouched and only rewrite the simple legacy forms.
  value = value.replace(/\^\s*\(([^()]*)\)/g, "^{$1}");
  value = value.replace(/\^\s*(-?[A-Za-z0-9.]+)/g, "^{$1}");

  // Stored explanations already contain these division shapes. Upgrade them to
  // a real fraction bar so old papers become readable immediately.
  value = value.replace(/\(([^()]+)\s*\/\s*([^()]+)\)/g, "\\left(\\frac{$1}{$2}\\right)");
  value = value.replace(/\\(ln|log)\(([^)]+)\)\s*\/\s*(-?\\[A-Za-z]+)/g, "\\frac{\\$1($2)}{$3}");
  return value;
}

const LEGACY_PATTERNS = [
  /P\s*\([^\n)]*\)\s*(?:>=|<=|=|>|<|≥|≤)\s*e\s*\^\s*(?:\([^\n)]*\)|\{[^\n}]*\}|[-+]?[A-Za-z0-9.]+)/g,
  /P\s*\([^\n)]*\)\s*(?:>=|<=|=|>|<|≥|≤)\s*[-+]?[0-9.]+/g,
  /e\s*\^\s*(?:\([^\n)]*\)|\{[^\n}]*\}|[-+]?[A-Za-z0-9.]+)(?:\s*\([^\n)]*\))?(?:\s*(?:>=|<=|=|>|<|≥|≤)\s*[-+]?[A-Za-z0-9.]+)?/g,
  /-?\b(?:lambda|mu|sigma|theta|rho)\b\s*\*\s*[A-Za-z]\s*(?:>=|<=|=|>|<|≥|≤)\s*(?:ln|log)\s*\([^\n)]*\)/gi,
  /\b[A-Za-z]\s*(?:>=|<=|=|>|<|≥|≤)\s*(?:ln|log)\s*\([^\n)]*\)\s*\/\s*-?\s*(?:lambda|mu|sigma|theta|rho)\b/gi,
  /\b(?:X|Y|Z)\s*~\s*[A-Za-z]+\s*\([^\n)]*\)/g,
  /\b(?:sqrt|ln|log|sin|cos|tan|exp)\s*\([^\n)]*\)(?:\s*(?:=|>|<|≥|≤)\s*[-+A-Za-z0-9.^()/* ]+)?/gi,
  /\b[A-Za-z]\s*[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:\s*(?:=|>|<|≥|≤|\+|-|×|÷|\*|\/)\s*[-+A-Za-z0-9.^()⁰¹²³⁴⁵⁶⁷⁸⁹ ]+)?/g,
];

function looksLikeWholeMath(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/\\(?:frac|tfrac|dfrac|sqrt|sum|prod|int|lim|log|ln|sin|cos|tan|exp|lambda|mu|sigma|theta|pi|rho)\b/.test(value)) {
    return true;
  }
  const words = value.match(/[A-Za-z]{3,}/g) ?? [];
  return words.length <= 3
    && /[=^<>~≤≥≠≈×÷⁰¹²³⁴⁵⁶⁷⁸⁹]|(?:\d|[A-Za-z])\s*[+\-*/]\s*(?:\d|[A-Za-z])/.test(value)
    && /^[A-Za-z0-9_{}()[\].,+\-*/^<>=~!\\\s%≤≥≠≈×÷λμσθπραβγδ⁰¹²³⁴⁵⁶⁷⁸⁹]+$/.test(value);
}

function firstLegacyMatch(text: string): { index: number; value: string } | null {
  let best: { index: number; value: string } | null = null;
  for (const pattern of LEGACY_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match || match.index == null) continue;
    if (!best || match.index < best.index || (match.index === best.index && match[0].length > best.value.length)) {
      best = { index: match.index, value: match[0] };
    }
  }
  return best;
}

function legacyTokens(text: string): Token[] {
  if (!text) return [];
  if (looksLikeWholeMath(text)) {
    return [{ kind: "math", value: normaliseLegacyLatex(text), display: false }];
  }

  const out: Token[] = [];
  let rest = text;
  while (rest) {
    const hit = firstLegacyMatch(rest);
    if (!hit) {
      out.push({ kind: "text", value: rest });
      break;
    }
    if (hit.index > 0) out.push({ kind: "text", value: rest.slice(0, hit.index) });
    out.push({ kind: "math", value: normaliseLegacyLatex(hit.value), display: false });
    rest = rest.slice(hit.index + hit.value.length);
  }
  return out;
}

function tokensFor(text: string): Token[] {
  const explicit = explicitTokens(text);
  const out: Token[] = [];
  for (const token of explicit) {
    if (token.kind === "math") out.push(token);
    else out.push(...legacyTokens(token.value));
  }
  return out;
}

export default function MathText({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  const tokens = tokensFor(text);

  return (
    <span className={["mathtext", className].filter(Boolean).join(" ")}>
      {tokens.map((token, index) => {
        if (token.kind === "math") {
          return <SafeLatex key={index} latex={token.value} display={token.display} />;
        }
        const lines = token.value.split("\n");
        return (
          <Fragment key={index}>
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {line}
                {lineIndex < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </span>
  );
}
