"use client";

import type { BillingInfo, SaveAddressInput, SavedAddress, ShippingAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import Image from "next/image";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { BillingCard } from "@/components/checkout/BillingCard";
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
  /** Prefills a newly created address's recipient — the buyer's own contact info, already confirmed one step earlier (M13-checkout-redesign). Not shown as editable fields here; see `AddressFields`'s `showRecipientFields`. */
  profile: { firstName: string; lastName: string; phone?: string };
  /** The account's own saved CFDI data, threaded through to the `BillingCard` rendered at the end of this card. */
  initialBillingInfo?: BillingInfo;
  /** Whether this card is the one open in the checkout accordion — see `ShippingStepView`. */
  open: boolean;
  /** True while Contacto hasn't been confirmed yet — no address fields are shown until then. */
  locked: boolean;
  /** Re-opens this card as the active step (the "Editar" affordance in its collapsed summary). */
  onEdit: () => void;
  /** A shipping address was confirmed — advances the accordion to Pago. */
  onDone: () => void;
}

type Mode = "choose" | "create";

const EMPTY_FORM: SaveAddressInput = {
  label: "",
  firstName: "",
  lastName: "",
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
    firstName: input.firstName,
    lastName: input.lastName,
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
 * The Envío card of the checkout accordion — address only (M13-checkout-
 * redesign moved the recipient's own name/phone one step earlier, into
 * `ContactCard`; this card only ever asks for the physical address). Whether
 * it's open, locked, or collapsed to its summary is decided by
 * `ShippingStepView` (single accordion owner) via `open`/`locked`; internally
 * it only tracks which *form* to show while open — `"choose"` (radio list of
 * the address book, pre-selected to the default) or `"create"` (the
 * account's own `AddressFields` with the "Nombre de la dirección" and
 * recipient fields hidden — the label is derived from `street`, and the
 * recipient is silently the buyer confirmed in Contacto, via `profile`).
 *
 * Confirming, whichever mode got there, runs the same three-step sequence:
 * create the address if it's new, promote it to default if it isn't already,
 * then `PUT /cart/shipping-address` — exactly the order the spec fixes,
 * because the *next* visit should autofill with whichever address the
 * customer actually paid with.
 */
export function ShippingAddressCard({
  addresses,
  onAddressesChange,
  profile,
  initialBillingInfo,
  open,
  locked,
  onEdit,
  onDone,
}: ShippingAddressCardProps) {
  const { cart, setShippingAddress } = useCart();
  const confirmedAddress = cart?.shippingAddress;
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  const [mode, setMode] = useState<Mode>(() => (addresses.length === 0 ? "create" : "choose"));
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultAddress?.id);
  const [form, setForm] = useState<SaveAddressInput>(() => ({
    ...EMPTY_FORM,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
  }));
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
      onDone();
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
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
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
      onDone();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  if (locked) {
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <div className="flex items-center gap-xs">
          <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
          <h2 className="font-display text-h2 text-negro">Envío</h2>
        </div>
        <p className="font-body text-body text-grafito">Completa tus datos de contacto para continuar.</p>
      </section>
    );
  }

  if (!open) {
    const shown = confirmedAddress ?? (selectedId ? addresses.find((address) => address.id === selectedId) : undefined);
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <div className="flex items-start justify-between gap-sm">
          <div className="flex items-center gap-xs">
            <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
            <h2 className="font-display text-h2 text-negro">Envío</h2>
          </div>
          <Button variant="text" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
        {shown ? (
          <div>
            <p className="font-ui text-ui text-negro">
              {shown.street}
              {shown.interiorNumber ? ` int. ${shown.interiorNumber}` : ""}
            </p>
            <p className="font-body text-caption text-grafito">
              {shown.neighborhood}, {shown.city}, {shown.state} · {shown.postalCode}
            </p>
            {shown.references ? <p className="font-body text-caption text-grafito">{shown.references}</p> : null}
          </div>
        ) : null}
        {bookFullNotice ? (
          <p className="font-body text-caption text-estado-advertencia">
            Tu libreta está llena, así que esta dirección se usa solo para este pedido.
          </p>
        ) : null}
        <BillingCard initialBillingInfo={initialBillingInfo} bare />
      </section>
    );
  }

  if (mode === "create") {
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <div className="flex items-center gap-xs">
        <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
        <h2 className="font-display text-h2 text-negro">Envío</h2>
      </div>
        <AddressFields
          form={form}
          errors={errors}
          onChange={set}
          showLabelField={false}
          showRecipientFields={false}
          showCountryField
        />
        <BillingCard initialBillingInfo={initialBillingInfo} bare />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
        <div className="flex items-center gap-md">
          <Button variant="primary" size="md" loading={submitting} onClick={() => void confirmNew()}>
            Guardar y continuar
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
      <div className="flex items-center gap-xs">
        <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
        <h2 className="font-display text-h2 text-negro">Envío</h2>
      </div>
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
                {address.street} · {address.firstName} {address.lastName} · {address.neighborhood}, {address.city},{" "}
                {address.state} · {address.postalCode}
              </span>
            </span>
          </label>
        ))}
      </div>
      <BillingCard initialBillingInfo={initialBillingInfo} bare />
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
