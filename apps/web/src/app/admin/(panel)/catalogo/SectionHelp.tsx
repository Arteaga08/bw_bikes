import { HelpPopover } from "@/components/ui/HelpPopover";
import { HELP_CONTENT } from "./help-content";
import { PdpDiagram, type PdpDiagramZone } from "./PdpDiagram";

/**
 * Pairs `PdpDiagram` with its matching copy from `help-content.ts` inside a
 * `HelpPopover` — the one shape every "¿dónde sale esto?" button shares.
 * Its own file (not colocated with `ProductEditor.tsx`, which is where most
 * of its callers live) because `ProductBasicsSection.tsx` and
 * `BikeBasicsFields.tsx` need it too, for "Descripción"/"Descripción corta",
 * and both of those are themselves imported *by* `ProductEditor.tsx` —
 * importing this from there would be circular.
 */
export function SectionHelp({ zone }: { zone: PdpDiagramZone }) {
  const topic = HELP_CONTENT[zone];
  return (
    <HelpPopover label={topic.label}>
      <div className="flex flex-col gap-md">
        <PdpDiagram highlight={zone} />
        <p className="font-body text-body text-negro">{topic.text}</p>
      </div>
    </HelpPopover>
  );
}
