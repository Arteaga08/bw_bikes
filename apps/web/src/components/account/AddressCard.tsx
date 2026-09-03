"use client";

import type { SavedAddress } from "@bw-bikes/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface AddressCardProps {
  address: SavedAddress;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  settingDefault?: boolean;
}

/** One entry in the address book grid — label, recipient, full address, and its three row actions. */
export function AddressCard({ address, onEdit, onDelete, onSetDefault, settingDefault = false }: AddressCardProps) {
  return (
    <div className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex items-start justify-between gap-sm">
        <p className="font-ui text-ui text-negro">{address.label}</p>
        {address.isDefault ? <Badge variant="accent">Predeterminada</Badge> : null}
      </div>

      <div className="font-body text-body text-negro">
        <p>
          {address.firstName} {address.lastName}
        </p>
        <p>
          {address.street}
          {address.interiorNumber ? ` int. ${address.interiorNumber}` : ""}, {address.neighborhood}
        </p>
        <p>
          {address.city}, {address.state}, CP {address.postalCode}
        </p>
        <p className="text-grafito">{address.phone}</p>
      </div>

      <div className="mt-xs flex flex-wrap gap-sm">
        <Button variant="text" tone="neutral" onClick={onEdit}>
          Editar
        </Button>
        <Button variant="text" tone="danger" onClick={onDelete}>
          Eliminar
        </Button>
        {!address.isDefault ? (
          <Button variant="text" tone="neutral" loading={settingDefault} onClick={onSetDefault}>
            Marcar como predeterminada
          </Button>
        ) : null}
      </div>
    </div>
  );
}
