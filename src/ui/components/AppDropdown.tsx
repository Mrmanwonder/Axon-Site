import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./AppDropdown.css";

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
  const [activeIndex, setActiveIndex] = useState(0);
  const search = useRef({ text: "", at: 0 });
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 180, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const active = options.find((option) => option.value === value) ?? options[0];

  const openMenu = (last = false) => {
    if (!options.length) return;
    const selectedIndex = options.findIndex(option => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : last ? options.length - 1 : 0);
    search.current = { text: "", at: 0 };
    setOpen(true);
  };
  const boundedIndex = Math.min(activeIndex, options.length - 1);
  useLayoutEffect(() => {
    if (!open) return;
    if (!options.length) { setOpen(false); return; }
    menuRef.current?.focus({ preventScroll: true });
    document.getElementById(`${menuId}-option-${boundedIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, boundedIndex, menuId, options.length]);

  // Layout effect: the menu is placed before the browser paints it. A plain
  // effect drew it for one frame at the top-left corner of the screen first
  // (owner's phone, 5 Oct 2026).
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = Math.max(120, window.innerWidth - 24);
      const minimumWidth = variant === "sort" ? 190 : 176;
      const width = Math.min(Math.max(rect.width, minimumWidth), viewportWidth);
      const preferredLeft = align === "right" ? rect.right - width : rect.left;
      const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - width - 12));

      const estimatedHeight = Math.min(280, options.length * 42 + 12);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 12);
      const spaceAbove = Math.max(0, rect.top - 12);
      const openAbove = spaceBelow < Math.min(160, estimatedHeight) && spaceAbove > spaceBelow;
      const available = openAbove ? spaceAbove - 8 : spaceBelow - 8;
      const maxHeight = Math.max(88, Math.min(280, available));
      const menuHeight = Math.min(estimatedHeight, maxHeight);
      const top = openAbove
        ? Math.max(12, rect.top - 8 - menuHeight)
        : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 12);

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
  }, [align, open, options.length, variant]);

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
        disabled={!options.length}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowUp");
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
          tabIndex={-1}
          aria-activedescendant={boundedIndex >= 0 ? `${menuId}-option-${boundedIndex}` : undefined}
          onKeyDown={event => {
            if (event.key === "Tab") {
              // Restore the trigger before the browser advances through the
              // page's tab order; the portal must not send Tab to the page end.
              triggerRef.current?.focus();
              setOpen(false);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault(); event.stopPropagation();
              setOpen(false); triggerRef.current?.focus(); return;
            }
            let next = boundedIndex;
            if (event.key === "ArrowDown") next = Math.min(options.length - 1, boundedIndex + 1);
            else if (event.key === "ArrowUp") next = Math.max(0, boundedIndex - 1);
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (options[boundedIndex]) choose(options[boundedIndex].value);
              return;
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              const now = Date.now();
              const text = (now - search.current.at < 700 ? search.current.text : "") + event.key.toLocaleLowerCase();
              search.current = { text, at: now };
              const query = [...text].every(char => char === text[0]) ? text[0] : text;
              for (let offset = 1; offset <= options.length; offset++) {
                const index = (boundedIndex + offset) % options.length;
                if (options[index].label.toLocaleLowerCase().startsWith(query)) { next = index; break; }
              }
            } else return;
            event.preventDefault(); setActiveIndex(next);
          }}
          aria-label={ariaLabel}
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                tabIndex={-1}
                id={`${menuId}-option-${index}`}
                data-active={index === boundedIndex || undefined}
                onPointerMove={() => setActiveIndex(index)}
                onMouseDown={event => event.preventDefault()}
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
