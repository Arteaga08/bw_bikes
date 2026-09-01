"use client";

import type { CustomerFit } from "@bw-bikes/shared";
import { useState } from "react";
import { AccountCard } from "@/components/account/AccountCard";
import { FitForm } from "@/components/account/FitForm";
import { GearSizesCard } from "@/components/account/GearSizesCard";
import { Button } from "@/components/ui/Button";
import { RIDE_STYLES } from "@/lib/ride-styles";

export interface MisTallasViewProps {
  initialFit?: CustomerFit;
}

const EMPTY_FIT: CustomerFit = { gearSizes: [] };

export function MisTallasView({ initialFit }: MisTallasViewProps) {
  const [fit, setFit] = useState<CustomerFit>(initialFit ?? EMPTY_FIT);
  const [editingMeasure, setEditingMeasure] = useState(false);

  const rideStyleLabel = fit.rideStyle ? RIDE_STYLES.find((option) => option.value === fit.rideStyle)?.label : undefined;

  return (
    <div className="flex flex-col gap-lg">
      <AccountCard
        title="Tu medida"
        action={
          <Button variant="text" tone="neutral" onClick={() => setEditingMeasure(true)}>
            Editar
          </Button>
        }
      >
        {fit.heightCm !== undefined || rideStyleLabel ? (
          <dl className="grid gap-md sm:grid-cols-2">
            <div>
              <dt className="font-ui text-caption text-grafito">Estatura</dt>
              <dd className="font-body text-body text-negro">{fit.heightCm !== undefined ? `${fit.heightCm} cm` : "Sin guardar"}</dd>
            </div>
            <div>
              <dt className="font-ui text-caption text-grafito">Estilo de rodar</dt>
              <dd className="font-body text-body text-negro">{rideStyleLabel ?? "Sin guardar"}</dd>
            </div>
          </dl>
        ) : (
          <p className="font-body text-body text-grafito">Aún no guardas tu estatura ni tu estilo de rodar.</p>
        )}
      </AccountCard>

      <AccountCard title="Tallas de equipamiento">
        <GearSizesCard fit={fit} onSaved={setFit} />
      </AccountCard>

      {editingMeasure ? <FitForm fit={fit} onClose={() => setEditingMeasure(false)} onSaved={setFit} /> : null}
    </div>
  );
}
