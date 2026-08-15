import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ButtonContent, buttonClasses, type ButtonStyleOptions } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type NextLinkProps = ComponentPropsWithoutRef<typeof Link>;

export interface ButtonLinkProps extends Omit<NextLinkProps, "children">, Omit<ButtonStyleOptions, "loading"> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

/**
 * A link that looks like a button — navigation, not an action.
 *
 * Exists because wrapping a `Button` in a `Link` nests a `<button>` inside an
 * `<a>`: invalid HTML, and screen readers announce two controls where the user
 * sees one. Before M10.5 the panel had five of those, plus two places that
 * hand-copied the `text` variant's classes onto a plain `<a>` and a whole
 * client island (`GoToLoginButton`) written only to route around the problem.
 *
 * Deliberately a separate component rather than a polymorphic `as`/`asChild`
 * prop on `Button`: there's no `@radix-ui/react-slot` here, and a generic `as`
 * under this repo's `strict` + `noUncheckedIndexedAccess` config costs more
 * type machinery than two small components do.
 *
 * `loading` is not available — a link has no pending state; if an action can be
 * in flight, it is a `Button`.
 */
export function ButtonLink({ variant = "primary", size = "md", tone = "neutral", className, children, iconLeft, iconRight, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, tone }), className)} {...props}>
      <ButtonContent variant={variant} size={size} tone={tone} iconLeft={iconLeft} iconRight={iconRight}>
        {children}
      </ButtonContent>
    </Link>
  );
}
