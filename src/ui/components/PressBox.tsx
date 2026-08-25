/* ═══════════════════════════════════════════════════════════════════════════
   PRESS

   The prototype bound a spring-driven scale to every `.press` element at load
   and rebound it after any DOM injection (__axonRebindPress). In React the
   binding belongs to the component, so there is nothing to rebind and nothing
   to drift.

   Scale to .988 on pointer down, spring back on up / leave / cancel. Transform
   only — no layout, no shadow, no blur, per the motion rules.

   All five interactive states are covered, but they are not all here: default,
   hover and focus-visible are CSS (shell.css and app.css), because they are
   presentational and belong with the rest of the design system. Active is this
   spring. Disabled is handled here — a disabled control must not spring, must
   not fire, and must not report itself as pressable.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useRef } from "react";
import type { ElementType, ComponentPropsWithoutRef, Ref } from "react";
import { spring, seed, releaseSpring, SPRING } from "../lib/spring";

type PressBoxProps<T extends ElementType> = {
  as?: T;
  ref?: Ref<HTMLElement>;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "ref">;

export default function PressBox<T extends ElementType = "div">({
  as,
  ref,
  ...rest
}: PressBoxProps<T>) {
  const Tag = (as || "div") as ElementType;
  const id = useId();
  const key = "press" + id;
  const el = useRef<HTMLElement | null>(null);

  const disabled = (rest as { disabled?: boolean; "aria-disabled"?: boolean }).disabled === true;

  useEffect(() => {
    seed(key, 1);
    return () => releaseSpring(key);
  }, [key]);

  const go = (to: number) => {
    if (disabled) return;
    spring(key, {
      to,
      ...SPRING.press,
      onUpdate: (p) => {
        if (el.current) el.current.style.transform = `scale(${p.toFixed(4)})`;
      },
    });
  };

  return (
    <Tag
      {...rest}
      ref={(node: HTMLElement | null) => {
        el.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as { current: HTMLElement | null }).current = node;
      }}
      onPointerDown={() => go(.988)}
      onPointerUp={() => go(1)}
      onPointerLeave={() => go(1)}
      onPointerCancel={() => go(1)}
      style={{ willChange: "transform", ...(rest as { style?: object }).style }}
    />
  );
}
