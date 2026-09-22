import type { CSSProperties } from "react";

export default function SkeletonLoader({ label = "Loading Axon" }: { label?: string }) {
  const widths = ["72%", "91%", "84%"];
  return (
    <div className="axon-skeleton" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="axon-skeleton__top">
        <div className="axon-skeleton__bar axon-skeleton__bar--title" />
        <div className="axon-skeleton__disc" />
      </div>
      <div className="axon-skeleton__hero">
        <div className="axon-skeleton__bar axon-skeleton__bar--eyebrow" />
        <div className="axon-skeleton__bar axon-skeleton__bar--headline" />
        <div className="axon-skeleton__bar axon-skeleton__bar--headline axon-skeleton__bar--short" />
      </div>
      <div className="axon-skeleton__grid">
        {widths.map((width) => (
          <div className="axon-skeleton__card" key={width}>
            <div className="axon-skeleton__bar axon-skeleton__bar--card-title" style={{ "--sk-width": width } as CSSProperties} />
            <div className="axon-skeleton__bar" />
            <div className="axon-skeleton__bar axon-skeleton__bar--short" />
          </div>
        ))}
      </div>
    </div>
  );
}
