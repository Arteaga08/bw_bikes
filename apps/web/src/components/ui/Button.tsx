import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Shape/weight axis. `ghost` and `bare` are the same box at the same size and
 * differ only in whether they draw a resting border:
 *
 * - `ghost` (border) is a standalone tertiary action — "Agregar campo",
 *   "Editar", a filter. It needs the outline to read as a control at all.
 * - `bare` (no border) is a control that repeats down a row or a toolbar —
 *   reorder arrows, delete, close. Bordered, those turn into a grid of hard
 *   rectangles that gives the *least* important control in the row the
 *   *strongest* edge. Bare, they rest as a glyph and only grow a body under
 *   the cursor. Added at M10.5.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "bare" | "text";
export type ButtonSize = "md" | "sm" | "icon-sm" | "icon" | "icon-lg";
/**
 * Color axis, on top of the shape `variant` picks. Honored by `ghost`, `bare`
 * and (for `neutral`/`inverse`) `text`; the solid variants define their own
 * color entirely, so they ignore it.
 *
 * - `danger` is the reversible tier (Archivar: soft on hover, solid on press).
 * - `danger-strong` is the irreversible tier (Eliminar: solid immediately,
 *   skipping the soft step).
 * - `inverse` is for controls sitting on `overlay` (#0A0A0A) — the sidebar,
 *   the storefront footer, a dark modal — where the light-surface palette has
 *   no contrast at all.
 */
export type ButtonTone = "neutral" | "danger" | "danger-strong" | "inverse";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  loading?: boolean;
  /** Transient "it worked" state — see `ButtonProps.success`. */
  success?: boolean;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  /** Rendered before the label, wrapped in an `aria-hidden` span and constrained to 16px — pass the bare Phosphor glyph, no `size`/`aria-hidden` of your own. */
  iconLeft?: ReactNode;
  /** Same as `iconLeft`, after the label. */
  iconRight?: ReactNode;
  /** Optional so `size="icon"`/`"icon-lg"` can render a glyph alone — those always need an `aria-label` instead. */
  children?: ReactNode;
  /** Replaces the label with `successLabel` and a check, and blocks the control, for as long as it's true. Drive it with `useAsyncAction` rather than by hand. */
  success?: boolean;
  /** Shown while `success` is true. Say what happened, in past tense: "Agregado", "Guardado". */
  successLabel?: string;
}

// Every variant defines all six states explicitly (default/hover/active/
// disabled/focus-visible are Tailwind pseudo-classes; `loading` is handled
// separately below) — DESIGN_SYSTEM.md §5's "Precise-and-Contained Rule":
// no component ships with a casual, undefined state.
const VARIANT_CLASSES: Record<Exclude<ButtonVariant, "ghost" | "bare" | "text">, string> = {
  primary: cn(
    "bg-dorado text-negro",
    "hover:bg-dorado-hover active:bg-dorado-pressed",
    "disabled:bg-dorado-disabled disabled:text-dorado-disabled-text",
    "focus-visible:outline-negro",
  ),
  secondary: cn(
    "bg-negro text-blanco",
    "hover:bg-negro-hover active:bg-negro-pressed",
    "disabled:bg-negro-disabled disabled:text-negro-disabled-text",
    "focus-visible:outline-dorado",
  ),
};

// The tone tables below own every `text-*`, `border-*` and `bg-*` these three
// variants set, including the resting ones. That looks repetitive next to a
// shared base, but it's the only arrangement that survives without
// tailwind-merge (see `lib/cn.ts`): two utilities touching the same property in
// one className are resolved by generated-CSS order, not string order, so a
// base `text-negro` would win over a tone's `text-blanco/70` at random. Each
// property is written exactly once per (variant, tone) pair.
const GHOST_BASE_CLASSES = "bg-transparent border";

const GHOST_TONE_CLASSES: Record<ButtonTone, string> = {
  neutral: cn(
    "border-negro text-negro",
    "hover:border-negro hover:bg-negro hover:text-blanco",
    "active:bg-negro-pressed",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-negro",
  ),
  // Archivar: reversible (there's a "Restaurar"), so it earns a warning, not
  // an alarm — soft on hover, only reaching full color on press.
  danger: cn(
    "border-negro text-negro",
    "hover:border-estado-error hover:bg-estado-error-soft hover:text-estado-error",
    "active:border-estado-error active:bg-estado-error active:text-blanco",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-estado-error",
  ),
  // Eliminar: irreversible, so hover skips straight to solid — the two tiers
  // read as different severities without a second red token.
  "danger-strong": cn(
    "border-negro text-negro",
    "hover:border-estado-error hover:bg-estado-error hover:text-blanco",
    "active:border-estado-error active:bg-estado-error active:text-blanco",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-estado-error",
  ),
  inverse: cn(
    "border-blanco/30 text-blanco",
    "hover:border-dorado hover:bg-transparent hover:text-dorado",
    "active:bg-blanco/10",
    "disabled:text-blanco/30 disabled:border-blanco/10",
    "focus-visible:outline-dorado",
  ),
};

// `bare` rests with no box at all: the glyph sits in `grafito` so it reads as
// secondary to the labelled controls beside it, and on hover it *lifts* to
// `surface` (white) with a hairline — the same body the inputs beside it have,
// so the control announces itself as a control rather than dimming into the
// panel.
//
// The rule underneath is "separate by one step from your own ground", and it
// has one consequence worth knowing: inside a `ButtonGroup`, which carries a
// white body of its own, white-on-white would be invisible. That case is
// handled by a scoped rule in `globals.css` (`.btn-group-solid > button:hover`)
// rather than another utility here, because two `hover:bg-*` classes on one
// element are resolved by generated-CSS order, not string order — see
// `lib/cn.ts`. A plain descendant selector wins on specificity, deterministically.
const BARE_BASE_CLASSES = "bg-transparent border border-transparent";

const BARE_TONE_CLASSES: Record<ButtonTone, string> = {
  neutral: cn(
    "text-grafito",
    "hover:border-borde hover:bg-surface hover:text-negro",
    "active:bg-borde",
    "disabled:text-negro-disabled-text",
    "focus-visible:outline-negro",
  ),
  danger: cn(
    "text-grafito",
    "hover:bg-estado-error-soft hover:text-estado-error",
    "active:bg-estado-error active:text-blanco",
    "disabled:text-negro-disabled-text",
    "focus-visible:outline-estado-error",
  ),
  "danger-strong": cn(
    "text-grafito",
    "hover:bg-estado-error hover:text-blanco",
    "active:bg-estado-error active:text-blanco",
    "disabled:text-negro-disabled-text",
    "focus-visible:outline-estado-error",
  ),
  inverse: cn(
    "text-blanco/70",
    "hover:bg-blanco/10 hover:text-dorado",
    "active:bg-blanco/15",
    "disabled:text-blanco/30",
    "focus-visible:outline-dorado",
  ),
};

// No static border-b: the underline is the animated span rendered below, so it
// can grow from the center instead of always being on.
const TEXT_BASE_CLASSES = "relative bg-transparent rounded-none h-auto px-1";

// `text` is a link, not a surface, so it has no room for a two-step
// hover→press escalation and the danger tiers collapse into one another. Both
// map to the same red here on purpose rather than pretending to differ.
const TEXT_TONE_CLASSES: Record<ButtonTone, string> = {
  neutral: cn("text-negro", "hover:text-dorado", "disabled:text-negro-disabled-text", "focus-visible:outline-negro"),
  danger: cn("text-estado-error", "hover:text-estado-error", "disabled:text-negro-disabled-text", "focus-visible:outline-estado-error"),
  "danger-strong": cn("text-estado-error", "hover:text-estado-error", "disabled:text-negro-disabled-text", "focus-visible:outline-estado-error"),
  inverse: cn("text-blanco/70", "hover:text-dorado", "disabled:text-blanco/30", "focus-visible:outline-dorado"),
};

// The grown underline takes the tone's own color, not the accent: a dorado
// line under a red "Eliminar" would put the system's single accent inside a
// destructive control, which is the one place it must not appear.
const TEXT_UNDERLINE_CLASSES: Record<ButtonTone, string> = {
  neutral: "bg-dorado",
  danger: "bg-estado-error",
  "danger-strong": "bg-estado-error",
  inverse: "bg-dorado",
};

// The transient "it worked" state. Uses the system's own `estado-exito`, not a
// new green, and holds the control's exact box so the label swap never shifts
// the layout around it. Never interactive: `success` implies `disabled`, which
// is the point — it's the window in which a second click can't land.
const SUCCESS_CLASSES = cn(
  "border border-estado-exito bg-estado-exito-soft text-estado-exito",
  "disabled:cursor-default",
  "focus-visible:outline-estado-exito",
);

const CONTROL_CLASSES =
  "inline-flex items-center justify-center gap-sm font-ui text-ui rounded-control transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-offset-2";

const TEXT_CONTROL_CLASSES =
  "group inline-flex items-center gap-xs font-ui text-ui transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2";

// Kept apart from CONTROL_CLASSES so a size never has to fight the base
// classes for the same property without tailwind-merge (see `lib/cn.ts`) —
// which is also why every square a caller might need is a size here rather
// than an `h-*`/`w-*` passed through `className`: that override loses to
// SIZE_CLASSES by generated-CSS order, silently.
//
// `icon` (36px) is the row-action square; `icon-lg` (44px) is the standalone
// chrome control, which needs the full touch target that would make a dense
// table row too tall; `icon-sm` (20px) is for a control inside something
// smaller than itself, like the remove × of a chip.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-11 px-lg",
  sm: "h-9 px-md",
  "icon-sm": "h-5 w-5 p-0",
  icon: "h-9 w-9 p-0",
  "icon-lg": "h-11 w-11 p-0",
};

// The `loading` spinner is positioned `left-lg`/`left-md` to match each
// size's own horizontal padding, so it never sits closer to the edge than
// the label it's replacing does. The icon sizes have no label to make room
// for, so their spinner centers instead.
const SPINNER_POSITION_CLASSES: Record<ButtonSize, string> = {
  md: "left-lg",
  sm: "left-md",
  "icon-sm": "left-1/2 -translate-x-1/2",
  icon: "left-1/2 -translate-x-1/2",
  "icon-lg": "left-1/2 -translate-x-1/2",
};

/**
 * The single class matrix behind every button-shaped control in the panel.
 * Exported so `ButtonLink` (an `<a>`) and `ButtonGroup` (segmented children)
 * render byte-identical styling instead of hand-copying it — the drift that
 * produced three different close "×" and two hand-rolled `text` links before
 * M10.5.
 */
export function buttonClasses({ variant = "primary", size = "md", tone = "neutral", loading = false, success = false }: ButtonStyleOptions = {}): string {
  const isText = variant === "text";

  let variantClasses: string;
  if (variant === "ghost") {
    variantClasses = cn(GHOST_BASE_CLASSES, GHOST_TONE_CLASSES[tone]);
  } else if (variant === "bare") {
    variantClasses = cn(BARE_BASE_CLASSES, BARE_TONE_CLASSES[tone]);
  } else if (isText) {
    variantClasses = cn(TEXT_BASE_CLASSES, TEXT_TONE_CLASSES[tone]);
  } else {
    variantClasses = VARIANT_CLASSES[variant];
  }

  return cn(
    isText ? TEXT_CONTROL_CLASSES : CONTROL_CLASSES,
    !isText && SIZE_CLASSES[size],
    // `success` replaces the variant's colors outright rather than layering on
    // top: two `bg-*` on one element would fight by generated-CSS order.
    success ? SUCCESS_CLASSES : variantClasses,
    // Marker the scoped rule in `globals.css` keys the in-group hover off —
    // see the comment on BARE_BASE_CLASSES.
    variant === "bare" && tone === "neutral" && "is-bare-neutral",
    loading && "relative",
  );
}

// The glyph scales with the control, so callers never pass a `size` to the
// icon itself: 16px everywhere the control is 36–44px with a label, 20px on
// the standalone 44px square where a 16px glyph floats in too much room, and
// 12px inside a 20px chip control. Enforced in CSS rather than by cloning the
// element, because Phosphor renders `width`/`height` attributes that a class
// overrides but a prop merge would fight over.
const ICON_SLOT_CLASSES: Record<ButtonSize, string> = {
  md: "[&>svg]:h-4 [&>svg]:w-4",
  sm: "[&>svg]:h-4 [&>svg]:w-4",
  "icon-sm": "[&>svg]:h-3 [&>svg]:w-3",
  icon: "[&>svg]:h-4 [&>svg]:w-4",
  "icon-lg": "[&>svg]:h-5 [&>svg]:w-5",
};

/**
 * Phosphor's `Check` at `regular` weight, inlined.
 *
 * Copied rather than imported so this module keeps zero icon-library imports:
 * `@phosphor-icons/react`'s default entry is client-only, and `Button` is
 * imported by Server Components (`catalogo/bicicletas/page.tsx` and friends).
 * Same path data and stroke weight as the rest of the set, so it can't look
 * like a different icon family.
 */
function CheckIcon() {
  return (
    <svg viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="216 72 104 184 48 128" />
    </svg>
  );
}

/** Glyph slot: callers pass the bare Phosphor icon and get consistent sizing and `aria-hidden` for free. */
function IconSlot({ size, children }: { size: ButtonSize; children: ReactNode }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0", ICON_SLOT_CLASSES[size])}>
      {children}
    </span>
  );
}

export interface ButtonContentProps extends ButtonStyleOptions {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

/**
 * The inner markup shared by `Button` and `ButtonLink` — spinner, icon slots,
 * label, and the `text` variant's hover underline. Kept as one component so a
 * `<a>` styled as a button can never drift from the `<button>` it mirrors.
 */
export function ButtonContent({ variant = "primary", size = "md", tone = "neutral", loading = false, iconLeft, iconRight, children }: ButtonContentProps) {
  return (
    <>
      {loading ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inline-block h-[10px] w-[10px] animate-spin rounded-full border-2 border-current border-t-transparent",
            variant === "text" ? "left-1" : SPINNER_POSITION_CLASSES[size],
          )}
        />
      ) : null}
      {/* `invisible`, not the button's own `text-transparent` — the spinner
          above reads `border-current` off this same element's color, and a
          transparent button color would blank the spinner out too. `invisible`
          keeps the layout box (so the button doesn't shrink) without touching
          `color`, and — unlike a color utility — it can't lose a specificity
          fight against `disabled:text-*` the way a plain `text-transparent`
          class did (both single-property utilities of equal specificity,
          `:disabled` included, resolved by generation order, not source order). */}
      <span className={cn("contents", loading && "invisible")}>
        {iconLeft ? <IconSlot size={size}>{iconLeft}</IconSlot> : null}
        {children}
        {iconRight ? <IconSlot size={size}>{iconRight}</IconSlot> : null}
      </span>
      {variant === "text" ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 bottom-0 h-px origin-center scale-x-0 transition-transform duration-150 group-hover:scale-x-100",
            TEXT_UNDERLINE_CLASSES[tone],
          )}
        />
      ) : null}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    tone = "neutral",
    loading = false,
    success = false,
    successLabel,
    disabled,
    className,
    children,
    iconLeft,
    iconRight,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // `success` disables too: the confirmation window is exactly the window
      // in which a second click must not land.
      disabled={disabled || loading || success}
      aria-busy={loading || undefined}
      className={cn(buttonClasses({ variant, size, tone, loading, success }), className)}
      {...props}
    >
      {success ? (
        <>
          <IconSlot size={size}>
            <CheckIcon />
          </IconSlot>
          {successLabel ?? children}
        </>
      ) : (
        <ButtonContent variant={variant} size={size} tone={tone} loading={loading} iconLeft={iconLeft} iconRight={iconRight}>
          {children}
        </ButtonContent>
      )}
    </button>
  );
});
