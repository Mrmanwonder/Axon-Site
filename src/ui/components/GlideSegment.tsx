import type { CSSProperties } from "react";

/* The onboarding selector (Class and Board) as a reusable control: a sunk
   track with a raised pill that glides to the chosen option. One pill, one
   transform; the labels never move. Use it where a row picks one of two to
   four short options. */
export default function GlideSegment<T extends string>({ label, options, value, onChange, className = "" }: {
  label: string;
  /* `lang` marks an option whose label is in another language than the page
     around it, such as हिन्दी on an English screen, so it is announced and
     shaped as that language. */
  options: { value: T; label: string; lang?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`gseg ${className}`.trim()} role="group" aria-label={label}
         style={{ "--gseg-n": options.length, "--gseg-i": index } as CSSProperties}>
      <span className="gseg-pill" aria-hidden="true" />
      {options.map((o) => (
        <button type="button" key={o.value} aria-pressed={o.value === value} lang={o.lang}
                onClick={() => { if (o.value !== value) onChange(o.value); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
