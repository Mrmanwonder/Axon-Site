import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/*
 * Student-facing rich text with safe maths.
 *
 * Model output, OCR and teacher text are all untrusted. KaTeX is therefore
 * deliberately run with trust disabled, bounded expansion and throw-on-error.
 * A malformed expression falls back to the exact source text; it never takes
 * the surrounding explanation down with it.
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
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  const html = useMemo(() => renderSafeLatex(latex, display), [latex, display]);
  if (!html) {
    return <span className={["math-raw", className].filter(Boolean).join(" ")}>{latex}</span>;
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

const EXPLICIT_MATH = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$)/g;

function explicitTokens(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(EXPLICIT_MATH)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: "text", value: text.slice(last, index) });
    const raw = match[0];
    const display = raw.startsWith("\\[") || raw.startsWith("$$");
    const value = raw.startsWith("\\[")
      ? raw.slice(2, -2)
      : raw.startsWith("\\(")
        ? raw.slice(2, -2)
        : raw.slice(2, -2);
    out.push({ kind: "math", value, display });
    last = index + raw.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out.length ? out : [{ kind: "text", value: text }];
}

function normaliseLegacyLatex(source: string): string {
  let value = source.trim();
  value = value
    .replace(/>=/g, "\\ge ")
    .replace(/<=/g, "\\le ")
    .replace(/!=/g, "\\ne ")
    .replace(/\blambda\b/gi, "\\lambda")
    .replace(/\bln\s*\(/gi, "\\ln(")
    .replace(/\s*\*\s*/g, " \\cdot ")
    .replace(/\s+~\s+/g, " \\sim ");

  // Common model notation: e^(-lambda*n) and e^-4.58. Keep already-braced
  // LaTeX untouched and only rewrite the simple legacy forms.
  value = value.replace(/\^\s*\(([^()]*)\)/g, "^{$1}");
  value = value.replace(/\^\s*(-?[A-Za-z0-9.]+)/g, "^{$1}");
  // Two legacy shapes already exist in stored explanations. Upgrade them to a
  // real fraction bar so old papers become readable immediately rather than
  // waiting to be reprocessed by the stricter prompt.
  value = value.replace(/\(([^()]+)\s*\/\s*([^()]+)\)/g, "\\left(\\frac{$1}{$2}\\right)");
  value = value.replace(/\\ln\(([^)]+)\)\s*\/\s*(-?\\lambda)/g, "\\frac{\\ln($1)}{$2}");
  return value;
}

const LEGACY_PATTERNS = [
  /P\s*\([^\n)]*\)\s*(?:>=|<=|=|>|<)\s*e\s*\^\s*(?:\([^\n)]*\)|\{[^\n}]*\}|[-+]?[A-Za-z0-9.]+)/g,
  /P\s*\([^\n)]*\)\s*(?:>=|<=|=|>|<)\s*[-+]?[0-9.]+/g,
  /e\s*\^\s*(?:\([^\n)]*\)|\{[^\n}]*\}|[-+]?[A-Za-z0-9.]+)(?:\s*\([^\n)]*\))?(?:\s*(?:>=|<=|=|>|<)\s*[-+]?[A-Za-z0-9.]+)?/g,
  /-?\blambda\b\s*\*\s*[A-Za-z]\s*(?:>=|<=|=|>|<)\s*ln\s*\([^\n)]*\)/gi,
  /\b[A-Za-z]\s*(?:>=|<=|=|>|<)\s*ln\s*\([^\n)]*\)\s*\/\s*-?\s*lambda\b/gi,
  /\b(?:X|Y|Z)\s*~\s*[A-Za-z]+\s*\([^\n)]*\)/g,
];

function looksLikeWholeMath(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/\\(?:frac|tfrac|sqrt|sum|int|lambda|mu|sigma|theta|pi)\b/.test(value)) return true;
  const words = value.match(/[A-Za-z]{3,}/g) ?? [];
  return words.length <= 3
    && /[=^<>~]|(?:\d|[A-Za-z])\s*[+\-*/]\s*(?:\d|[A-Za-z])/.test(value)
    && /^[A-Za-z0-9_{}()[\].,+\-*/^<>=~!\\\s%]+$/.test(value);
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
