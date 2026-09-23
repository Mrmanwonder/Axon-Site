import * as avatarMod from "../../avatar.js";

const AVATAR_PRESETS = avatarMod.PRESETS;
const backgroundFor = avatarMod.backgroundFor;
const inkFor = avatarMod.inkFor;
import { hapticTick } from "../lib/haptics";

type Props = {
  value: string;
  label?: string;
  studentName?: string;
  onChange: (key: string) => void;
};

export default function AvatarPicker({ value, label = "Picture", studentName = "", onChange }: Props) {
  const initial = studentName.trim()[0]?.toUpperCase() ?? "?";
  return (
    <>
      <div className="sectitle">{label}</div>
      <div className="card lookcard">
        <fieldset className="lookrow" aria-label={label}>
          {AVATAR_PRESETS.map((preset) => {
            const selected = value === preset.key;
            return (
              <label
                key={preset.key}
                className={"look" + (selected ? " on" : "")}
                title={preset.title}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={preset.key}
                  checked={selected}
                  aria-label={preset.title}
                  onChange={() => {
                    hapticTick();
                    onChange(preset.key);
                  }}
                />
                <span
                  className="disc"
                  aria-hidden="true"
                  style={{ background: backgroundFor(preset), color: inkFor(preset) }}
                >
                  {initial}
                </span>
              </label>
            );
          })}
        </fieldset>
      </div>
    </>
  );
}
