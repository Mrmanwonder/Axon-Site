import { useRef, useState } from "react";
import Dialog from "./Dialog";
import { hapticTick } from "../lib/haptics";
import {
  AVATAR_PRESETS,
  avatarRenderFor,
  initialFor,
} from "../data/modules";
import type { AvatarPreset } from "../data/modules";
import "./AvatarPicker.css";

export function AvatarDisc({
  presetKey,
  label,
  className = "",
}: {
  presetKey?: string | null;
  label?: string | null;
  className?: string;
}) {
  const render = avatarRenderFor({ avatar_seed: presetKey ?? null });
  return <span
    className={`avatar-disc ${className}`.trim()}
    data-preset={render.preset}
    data-kind={render.kind}
    style={{ background: render.background, color: render.color }}
    aria-hidden="true"
  >
    {render.kind === "dot-face" && render.glyph ? (
      <svg viewBox={`0 0 ${render.glyph.size} ${render.glyph.size}`} focusable="false">
        {render.glyph.points.map((point, index) => (
          <circle
            key={index}
            cx={point.x + .5}
            cy={point.y + .5}
            r=".34"
            fill="currentColor"
            opacity={point.tone === 0 ? .34 : point.tone === 1 ? .58 : .92}
          />
        ))}
      </svg>
    ) : (
      <span>{initialFor(label)}</span>
    )}
  </span>;
}

function PresetButton({
  preset,
  selected,
  label,
  onPick,
}: {
  preset: AvatarPreset;
  selected: boolean;
  label?: string | null;
  onPick: (key: string) => void;
}) {
  return <button
    type="button"
    className={"avatar-option" + (selected ? " on" : "")}
    aria-label={preset.title}
    aria-pressed={selected}
    title={preset.title}
    onClick={() => { hapticTick(); onPick(preset.key); }}
  >
    <AvatarDisc presetKey={preset.key} label={label} />
  </button>;
}

export default function AvatarPicker({
  value,
  label,
  onChange,
  disabled = false,
}: {
  value: string;
  label?: string | null;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const quick = AVATAR_PRESETS.slice(0, 9);

  return <div className="avatar-picker">
    <div className="avatar-picker-compact">
      <AvatarDisc presetKey={value} label={label} className="avatar-preview" />
      <div className="avatar-quick" role="group" aria-label="Picture">
        {quick.map(preset => (
          <PresetButton
            key={preset.key}
            preset={preset}
            selected={value === preset.key}
            label={label}
            onPick={onChange}
          />
        ))}
      </div>
      <button
        ref={moreRef}
        type="button"
        className="avatar-more"
        disabled={disabled}
        onClick={() => { hapticTick(); setOpen(true); }}
      >
        More
      </button>
    </div>

    {open && <Dialog
      title="Choose a picture"
      description="Original gradients and dot illustrations. Axon does not ask for a photo."
      onClose={() => setOpen(false)}
      restoreFocus={moreRef.current}
    >
      <div className="avatar-grid" role="group" aria-label="All pictures">
        {AVATAR_PRESETS.map(preset => (
          <PresetButton
            key={preset.key}
            preset={preset}
            selected={value === preset.key}
            label={label}
            onPick={key => { onChange(key); }}
          />
        ))}
      </div>
      <div className="acts">
        <button type="button" className="btn primary" onClick={() => setOpen(false)}>Done</button>
      </div>
    </Dialog>}
  </div>;
}
