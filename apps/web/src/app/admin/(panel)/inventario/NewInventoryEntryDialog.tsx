"use client";

import type { AdminAccessory, AdminBike, ItemType, ProductVariant } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { adminAccessoriesApi, adminBikesApi } from "@/lib/api/admin-catalog";
import { listAdminInventory } from "@/lib/api/admin-inventory";

export interface NewInventoryEntryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { itemType: ItemType; itemId: string; sku: string; onHand: number }) => void | Promise<void>;
  submitting: boolean;
  /** Bike/accessory options for the product picker — passed in rather than fetched here, since the parent already has (or can cheaply get) the light product lists both tabs use. */
  bikeOptions: ComboboxOption[];
  accessoryOptions: ComboboxOption[];
}

/**
 * "Registrar entrada" never accepts a free-typed SKU — the backend validates
 * the triplet against a real variant (`assertVariantExists`), so a typo'd
 * SKU here would only ever produce a 404. Instead: pick the product, then
 * pick from *its* variants that don't already have a row — the product's
 * own `variants` array plus a per-product inventory lookup answers exactly
 * that.
 */
export function NewInventoryEntryDialog({
  open,
  onClose,
  onConfirm,
  submitting,
  bikeOptions,
  accessoryOptions,
}: NewInventoryEntryDialogProps) {
  const [itemType, setItemType] = useState<ItemType>("bike");
  const [itemId, setItemId] = useState("");
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [sku, setSku] = useState("");
  const [onHand, setOnHand] = useState("");

  // "Adjust state during render" — switching product resets the variant list
  // and the chosen SKU right here, in the render body; the effect below only
  // ever calls setState in response to the fetch actually settling.
  const requestKey = `${itemType}-${itemId}`;
  const [lastRequestKey, setLastRequestKey] = useState(requestKey);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setAvailableVariants([]);
    setSku("");
    setLoadingVariants(itemId !== "");
  }

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;

    Promise.all([
      itemType === "bike" ? adminBikesApi.getById(itemId) : adminAccessoriesApi.getById(itemId),
      listAdminInventory({ itemType, itemId, limit: 100 }),
    ])
      .then(([product, existing]) => {
        if (cancelled) return;
        const stockedSkus = new Set(existing.data.items.map((item) => item.sku));
        const variants = (product as AdminBike | AdminAccessory).variants.filter((variant) => !stockedSkus.has(variant.sku));
        setAvailableVariants(variants);
      })
      .finally(() => {
        if (!cancelled) setLoadingVariants(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  function handleClose(): void {
    setItemType("bike");
    setItemId("");
    setAvailableVariants([]);
    setSku("");
    setOnHand("");
    onClose();
  }

  const parsedOnHand = Number.parseInt(onHand, 10);
  const isOnHandValid = onHand.trim() !== "" && Number.isInteger(parsedOnHand) && parsedOnHand >= 0;
  const isValid = itemId !== "" && sku !== "" && isOnHandValid;

  async function handleSubmit(): Promise<void> {
    if (!isValid) return;
    await onConfirm({ itemType, itemId, sku, onHand: parsedOnHand });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar entrada"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} disabled={!isValid} onClick={() => void handleSubmit()}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Select
          label="Tipo de producto"
          value={itemType}
          onChange={(event) => {
            setItemType(event.target.value as ItemType);
            setItemId("");
          }}
        >
          <option value="bike">Bicicleta</option>
          <option value="accessory">Accesorio</option>
        </Select>

        <Combobox
          label="Producto"
          value={itemId}
          onChange={setItemId}
          options={itemType === "bike" ? bikeOptions : accessoryOptions}
          placeholder="Busca por nombre"
        />

        <Select
          label="Variante"
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          disabled={!itemId || loadingVariants || availableVariants.length === 0}
          helper={
            itemId && !loadingVariants && availableVariants.length === 0
              ? "Todas las variantes de este producto ya tienen una fila de inventario."
              : undefined
          }
        >
          <option value="">{loadingVariants ? "Cargando…" : "Elige una variante"}</option>
          {availableVariants.map((variant) => (
            <option key={variant.sku} value={variant.sku}>
              {[variant.size, variant.color].filter(Boolean).join(" / ") || variant.sku} — {variant.sku}
            </option>
          ))}
        </Select>

        <Input
          label="Stock inicial"
          inputMode="numeric"
          value={onHand}
          onChange={(event) => setOnHand(event.target.value)}
        />
      </div>
    </Modal>
  );
}
