import type { Icon } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon: Icon;
  milestone: string;
}

/**
 * The body every M8 nav destination renders today — M9–M11 replace this
 * with the real page, never touching the shell around it. Keeping this as
 * one shared component (rather than duplicating the same markup seven
 * times) means the "coming soon" treatment only needs to change in one
 * place if it ever does.
 */
export function PlaceholderPage({ title, subtitle, icon: IconComponent, milestone }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="p-lg">
        <EmptyState
          icon={<IconComponent size={32} weight="regular" />}
          title={`Próximamente en ${milestone}`}
          description="Esta sección llega en la siguiente fase del panel — el shell ya está listo para recibirla."
        />
      </div>
    </>
  );
}
