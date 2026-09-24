import { useRef, useState } from "react";
import type { CSSProperties } from "react";
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
            r=".28"
            fill="currentColor"
            opacity={point.tone === 0 ? .46 : point.tone === 1 ? .82 : .96}
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
  disabled,
  onPick,
}: {
  preset: AvatarPreset;
  selected: boolean;
  label?: string | null;
  disabled?: boolean;
  onPick: (key: string) => void;
}) {
  return <button
    type="button"
    className={"avatar-option" + (selected ? " on" : "")}
    aria-label={preset.title}
    aria-pressed={selected}
    title={preset.title}
    disabled={disabled}
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
  className = "",
  triggerClassName = "",
}: {
  value: string;
  label?: string | null;
  onChange: (key: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const render = avatarRenderFor({ avatar_seed: value });
  const selected = AVATAR_PRESETS.find(preset => preset.key === render.preset);
  const palettePreset = selected?.kind === "dot-face"
    ? AVATAR_PRESETS.find(preset => preset.kind === "gradient" && preset.key === selected.backgroundPreset)
    : selected;
  const fallbackPalette: [string, string, string, string] = palettePreset?.kind === "gradient"
    ? [
        palettePreset.c[0] ?? "#7f67ff",
        palettePreset.c[1] ?? "#8ff3df",
        palettePreset.c[2] ?? "#2d1c68",
        palettePreset.c[3] ?? palettePreset.c[1] ?? "#f5e8ff",
      ]
    : ["#7f67ff", "#8ff3df", "#2d1c68", "#f5e8ff"];
  // Keep the picker resilient to cached/test adapters that still return the
  // pre-palette AvatarRender shape while production clients roll forward.
  const [wash1, wash2, wash3, wash4] = render.palette ?? fallbackPalette;

  return <div
    className={`avatar-picker ${className}`.trim()}
    data-ambient-preset={render.preset}
    style={{
      "--avatar-wash-1": wash1,
      "--avatar-wash-2": wash2,
      "--avatar-wash-3": wash3,
      "--avatar-wash-4": wash4,
    } as CSSProperties}
  >
    <button
      ref={triggerRef}
      type="button"
      className={`avatar-trigger ${triggerClassName}`.trim()}
      disabled={disabled}
      aria-label="Change profile picture"
      aria-haspopup="dialog"
      onClick={() => { hapticTick(); setOpen(true); }}
    >
      <AvatarDisc presetKey={value} label={label} className="avatar-preview" />
      <span className="avatar-trigger-badge" aria-hidden="true">
        <svg viewBox="0 0 20 20">
          <path d="M4.2 13.9 3.7 16.3l2.4-.5L14.7 7.2 12.8 5.3 4.2 13.9Z" />
          <path d="m11.9 6.2 1.9 1.9" />
        </svg>
      </span>
    </button>

    {open && <Dialog
      className="avatar-dialog"
      title="Choose your picture"
      description="Pick a gradient or a dot portrait. Nothing is uploaded."
      onClose={() => setOpen(false)}
      restoreFocus={triggerRef.current}
    >
      <div className="avatar-ambient" aria-hidden="true" />
      <button
        type="button"
        className="avatar-dialog-close"
        aria-label="Close picture picker"
        onClick={() => setOpen(false)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>

      <div className="avatar-grid" role="group" aria-label="Profile pictures">
        {AVATAR_PRESETS.map(preset => (
          <PresetButton
            key={preset.key}
            preset={preset}
            selected={render.preset === preset.key}
            label={label}
            disabled={disabled}
            onPick={onChange}
          />
        ))}
      </div>

      <div className="avatar-dialog-footer">
        <span className="avatar-selection-name" aria-live="polite">
          {selected?.title ?? "Profile picture"}
        </span>
        <button type="button" className="btn primary avatar-done" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </Dialog>}
  </div>;
}
