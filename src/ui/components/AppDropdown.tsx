import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type AppDropdownOption = {
  value: string;
  label: string;
};

type Props = {
  ariaLabel: string;
  value: string;
  options: AppDropdownOption[];
  onChange: (value: string) => void;
  variant?: "chip" | "sort";
  selected?: boolean;
  align?: "left" | "right";
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function DownChevron() {
  return (
    <svg
      className="app-dropdown-chevron"
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="app-dropdown-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.2 5.5 10 11.5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One dropdown language for the whole app.
 *
 * The menu is portalled to <body> so a dropdown inside a horizontally scrolling
 * filter rail is not clipped by that rail. Native <select> popovers vary by OS
 * and browser; this keeps the interaction visually inside Axon's design system.
 */
export default function AppDropdown({
  ariaLabel,
  value,
  options,
  onChange,
  variant = "chip",
  selected = false,
  align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 180, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const active = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, variant === "sort" ? 190 : 176), Math.max(176, window.innerWidth - 24));
      const preferredLeft = align === "right" ? rect.right - width : rect.left;
      const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - width - 12));
      const top = Math.min(rect.bottom + 8, window.innerHeight - 72);
      const maxHeight = Math.max(96, window.innerHeight - top - 12);

      setPosition({ top, left, width, maxHeight });
    };

    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    place();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [align, open, variant]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const triggerClass = variant === "sort"
    ? "app-dropdown-trigger app-dropdown-sort"
    : `fchip app-dropdown-trigger${selected ? " is-filtered" : ""}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="app-dropdown-label">{active?.label ?? "Select"}</span>
        <DownChevron />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="app-dropdown-menu"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className="app-dropdown-option"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {isSelected && <Check />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
