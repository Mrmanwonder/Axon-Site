import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import MaterialSymbol from "./MaterialSymbol";
import "./EssentialButton.css";

/**
 * AXON B5 Essential.
 * Navigation is the only reason to render the blue forward glyph.
 * Actions never imply forward navigation. Uses the current theme's roles.
 */
export type EssentialVariant = "primary" | "secondary" | "quiet";
export type EssentialSize = "compact" | "medium" | "large";

type Common = {
  children: ReactNode;
  variant?: EssentialVariant;
  size?: EssentialSize;
  fullWidth?: boolean;
  className?: string;
};

type ActionButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className" | "size"> & { to?: never; loading?: boolean };

type NavButton = Common & {
  to: string;
  "aria-label"?: string;
  title?: string;
  onClick?: () => void;
  loading?: never;
  disabled?: never;
};

export type EssentialButtonProps = ActionButton | NavButton;

export default function EssentialButton(props: EssentialButtonProps) {
  const {
    variant = "primary",
    size = "medium",
    fullWidth = false,
    className = "",
    children,
  } = props;

  const classes = [
    "essential-button",
    "essential-button--" + variant,
    "essential-button--" + size,
    fullWidth ? "essential-button--full" : "",
    className,
  ].filter(Boolean).join(" ");

  if (props.to !== undefined) {
    const { to, title, onClick } = props;
    return (
      <Link to={to} className={classes} title={title} onClick={onClick}
        aria-label={props["aria-label"]}>
        <span className="essential-button__label">{children}</span>
        <MaterialSymbol name="back" size={20} className="essential-button__arrow" />
      </Link>
    );
  }

  const {
    variant: _variant,
    size: _size,
    fullWidth: _fullWidth,
    className: _className,
    children: _children,
    to: _to,
    loading = false,
    disabled,
    type = "button",
    ...rest
  } = props as ActionButton & { to?: never };
  // Explicit omission of style-system props prevents them becoming DOM attrs.
  void [_variant, _size, _fullWidth, _className, _children, _to];
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading}
      aria-busy={loading || undefined}>
      <span className="essential-button__label">{children}</span>
      {loading && <span className="essential-button__spinner" aria-hidden="true" />}
      {loading && <span className="essential-button__sr">Working</span>}
    </button>
  );
}
