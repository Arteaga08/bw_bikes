"use client";

import type { SaveAddressInput, SavedAddress, ShippingAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { createAccountAddress, setDefaultAccountAddress } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { AddressFields, validateAddress, type AddressFormErrors } from "@/components/account/AddressFields";

/**
 * Mirrors `MAX_LABEL_LENGTH` (`apps/api/src/models/schemas/saved-address.schema.ts`).
 * Re-declared here, not imported — `apps/web` never imports `apps/api` source
 * (same convention as `BULK_ALLOWED_STATUSES` in `lib/orders/status.ts`).
 */
const MAX_LABEL_LENGTH = 30;

export interface ShippingAddressCardProps {
  addresses: SavedAddress[];
  onAddressesChange: (addresses: SavedAddress[]) => void;
  profile: { firstName: string; lastName: string; phone?: string };
}

type Mode = "summary" | "choose" | "create";

const EMPTY_FORM: SaveAddressInput = {
  label: "",
  recipientName: "",
  phone: "",
  street: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: MEXICAN_STATES[0],
  postalCode: "",
  country: "MX",
  references: "",
};

function toShippingAddress(input: SavedAddress | SaveAddressInput): ShippingAddress {
  return {
    recipientName: input.recipientName,
    phone: input.phone,
    street: input.street,
    interiorNumber: input.interiorNumber,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country,
    references: input.references,
  };
}

/**
 * The Envío card of the checkout accordion (C1-checkout-datos.md §3, layout
 * A). Three modes: `"summary"` (already confirmed this session — collapsed,
 * "Editar" to reopen), `"choose"` (radio list of the address book,
 * pre-selected to the default), `"create"` (the account's own `AddressFields`
 * with the "Nombre de la dirección" field hidden — the label is derived from
 * `street`, never typed here).
 *
 * Confirming, whichever mode got there, runs the same three-step sequence:
 * create the address if it's new, promote it to default if it isn't already,
 * then `PUT /cart/shipping-address` — exactly the order the spec fixes,
 * because the *next* visit should autofill with whichever address the
 * customer actually paid with.
 */
export function ShippingAddressCard({ addresses, onAddressesChange, profile }: ShippingAddressCardProps) {
  const { cart, setShippingAddress } = useCart();
  const confirmedAddress = (cart as { shippingAddress?: ShippingAddress } | null)?.shippingAddress;
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  const [mode, setMode] = useState<Mode>(() => {
    if (confirmedAddress) return "summary";
    if (addresses.length === 0) return "create";
    return "choose";
  });
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultAddress?.id);
  const [form, setForm] = useState<SaveAddressInput>({
    ...EMPTY_FORM,
    recipientName: `${profile.firstName} ${profile.lastName}`.trim(),
    phone: profile.phone ?? "",
  });
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookFullNotice, setBookFullNotice] = useState(false);

  function set<K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function confirmExisting(addressId: string): Promise<void> {
    const address = addresses.find((entry) => entry.id === addressId);
    if (!address) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      let nextAddresses = addresses;
      if (!address.isDefault) {
        nextAddresses = await setDefaultAccountAddress(addressId);
        onAddressesChange(nextAddresses);
      }
      await setShippingAddress(toShippingAddress(address));
      setBookFullNotice(false);
      setMode("summary");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmNew(): Promise<void> {
    const nextErrors = validateAddress(form, { requireLabel: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: SaveAddressInput = {
      ...form,
      label: form.street.trim().slice(0, MAX_LABEL_LENGTH),
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      interiorNumber: form.interiorNumber?.trim() || undefined,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      references: form.references?.trim() || undefined,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      let usedAddress: SaveAddressInput | SavedAddress = payload;
      let bookFull = false;

      try {
        const created = await createAccountAddress(payload);
        onAddressesChange(created);
        const newest = created[created.length - 1]!;
        usedAddress = newest;
        if (!newest.isDefault) {
          const promoted = await setDefaultAccountAddress(newest.id);
          onAddressesChange(promoted);
        }
      } catch (err) {
        if (err instanceof ApiError && err.httpStatus === 409) {
          bookFull = true;
        } else {
          throw err;
        }
      }

      await setShippingAddress(toShippingAddress(usedAddress));
      setBookFullNotice(bookFull);
      setMode("summary");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "summary") {
    const shown = confirmedAddress ?? (selectedId ? addresses.find((address) => address.id === selectedId) : undefined);
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <div className="flex items-start justify-between gap-sm">
          <h2 className="font-display text-h4 text-negro">Envío</h2>
          <Button variant="text" size="sm" onClick={() => setMode("choose")}>
            Editar
          </Button>
        </div>
        {shown ? (
          <div>
            <p className="font-ui text-ui text-negro">{shown.street}</p>
            <p className="font-body text-caption text-grafito">
              {shown.recipientName} · {shown.neighborhood}, {shown.city}, {shown.state} · {shown.postalCode}
            </p>
          </div>
        ) : null}
        {bookFullNotice ? (
          <p className="font-body text-caption text-estado-advertencia">
            Tu libreta está llena, así que esta dirección se usa solo para este pedido.
          </p>
        ) : null}
      </section>
    );
  }

  if (mode === "create") {
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <h2 className="font-display text-h4 text-negro">Envío</h2>
        <AddressFields form={form} errors={errors} onChange={set} showLabelField={false} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
        <div className="flex items-center gap-md">
          <Button variant="primary" size="md" loading={submitting} onClick={() => void confirmNew()}>
            Guardar dirección
          </Button>
          {addresses.length > 0 ? (
            <Button variant="text" size="sm" onClick={() => setMode("choose")}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
      <h2 className="font-display text-h4 text-negro">Envío</h2>
      <div role="radiogroup" aria-label="Dirección de envío" className="flex flex-col gap-sm">
        {addresses.map((address) => (
          <label
            key={address.id}
            className="flex items-start gap-sm rounded-control border border-borde p-md has-checked:border-negro has-checked:bg-inset"
          >
            <input
              type="radio"
              name="shipping-address"
              value={address.id}
              checked={selectedId === address.id}
              onChange={() => setSelectedId(address.id)}
              className="mt-xs"
            />
            <span>
              <span className="block font-ui text-ui text-negro">{address.label}</span>
              <span className="block font-body text-caption text-grafito">
                {address.street} · {address.recipientName} · {address.neighborhood}, {address.city}, {address.state} ·{" "}
                {address.postalCode}
              </span>
            </span>
          </label>
        ))}
      </div>
      {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      <div className="flex items-center gap-md">
        <Button
          variant="primary"
          size="md"
          loading={submitting}
          disabled={!selectedId}
          onClick={() => selectedId && void confirmExisting(selectedId)}
        >
          Usar esta dirección
        </Button>
        <Button variant="text" size="sm" onClick={() => setMode("create")}>
          Agregar dirección
        </Button>
      </div>
    </section>
  );
}
