"use client";

import { Question } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface HelpPopoverProps {
  /** Names the trigger button ("Ayuda: {label}") and titles the dialog it opens. */
  label: string;
  children: ReactNode;
}

/**
 * The catalog editor's "?" — explains where a captured field or section ends
 * up on the public product page. Framed as a "popover" in the M10.7 plan,
 * but built directly on `Modal` rather than a bespoke anchored/floating
 * popover: this project has no positioning library (no Floating UI/Radix),
 * and a hand-rolled anchored popover risks exactly the small-screen overflow
 * problems the plan itself flagged as reason enough to fall back to `Modal`
 * — which already satisfies every actual requirement (Escape closes, focus
 * trapped while open, focus returned to the trigger on close, via the same
 * `useFocusTrap` hook) with none of that positioning risk.
 */
export function HelpPopover({ label, children }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="bare"
        size="icon-sm"
        aria-label={`Ayuda: ${label}`}
        onClick={() => setOpen(true)}
        iconLeft={<Question weight="bold" />}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        {children}
      </Modal>
    </>
  );
}
