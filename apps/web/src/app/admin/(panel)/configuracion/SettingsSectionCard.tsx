"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export interface SettingsSectionCardProps {
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: () => void;
  submitting: boolean;
}

/**
 * The shell every settings section shares — its own `<form>`, its own
 * Guardar button, its own submitting state. Six of these on one page is
 * what makes the backend's guarantee visible: `PUT /admin/settings/:section`
 * replaces one section atomically, so saving Envíos genuinely cannot touch
 * Órdenes — six independent forms is the honest UI for that, not one giant
 * form split visually into six boxes.
 */
export function SettingsSectionCard({ title, description, children, onSubmit, submitting }: SettingsSectionCardProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md rounded-card border border-borde bg-surface p-lg">
      <div>
        <h2 className="font-display text-h3 text-negro">{title}</h2>
        <p className="mt-xs font-body text-caption text-grafito">{description}</p>
      </div>
      <div className="flex flex-col gap-md sm:flex-row sm:flex-wrap">{children}</div>
      <div>
        <Button type="submit" variant="primary" loading={submitting}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
