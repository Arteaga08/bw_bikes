"use client";

import type { BillingInfo, SavedAddress } from "@bw-bikes/shared";
import { CFDI_USE_LABELS, TAX_REGIME_LABELS } from "@bw-bikes/shared";
import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { AccountCard } from "@/components/account/AccountCard";
import { AddressCard } from "@/components/account/AddressCard";
import { AddressForm } from "@/components/account/AddressForm";
import { BillingInfoForm } from "@/components/account/BillingInfoForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteAccountAddress, deleteAccountBillingInfo, setDefaultAccountAddress } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

export interface DireccionesViewProps {
  initialAddresses: SavedAddress[];
  initialBillingInfo?: BillingInfo;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function DireccionesView({ initialAddresses, initialBillingInfo }: DireccionesViewProps) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [billingInfo, setBillingInfo] = useState(initialBillingInfo);

  const [addressForm, setAddressForm] = useState<{ address?: SavedAddress } | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<SavedAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [addressActionError, setAddressActionError] = useState<string | null>(null);

  const [editingBillingInfo, setEditingBillingInfo] = useState(false);
  const [deletingBillingInfo, setDeletingBillingInfo] = useState(false);
  const [confirmDeleteBillingInfo, setConfirmDeleteBillingInfo] = useState(false);
  const [billingInfoError, setBillingInfoError] = useState<string | null>(null);

  async function handleDeleteAddress(): Promise<void> {
    if (!addressToDelete) return;
    setDeletingAddress(true);
    setAddressActionError(null);
    try {
      const next = await deleteAccountAddress(addressToDelete.id);
      setAddresses(next);
      setAddressToDelete(null);
    } catch (err) {
      setAddressActionError(apiErrorMessage(err, "No se pudo eliminar la dirección."));
    } finally {
      setDeletingAddress(false);
    }
  }

  async function handleSetDefault(address: SavedAddress): Promise<void> {
    setSettingDefaultId(address.id);
    setAddressActionError(null);
    try {
      const next = await setDefaultAccountAddress(address.id);
      setAddresses(next);
    } catch (err) {
      setAddressActionError(apiErrorMessage(err, "No se pudo marcar la dirección como predeterminada."));
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDeleteBillingInfo(): Promise<void> {
    setDeletingBillingInfo(true);
    setBillingInfoError(null);
    try {
      await deleteAccountBillingInfo();
      setBillingInfo(undefined);
      setConfirmDeleteBillingInfo(false);
    } catch (err) {
      setBillingInfoError(apiErrorMessage(err, "No se pudieron eliminar los datos fiscales."));
    } finally {
      setDeletingBillingInfo(false);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <section className="flex flex-col gap-md">
        <div className="flex items-center justify-between gap-sm">
          <h1 className="font-display text-h3 text-negro">Libreta de direcciones</h1>
          <Button variant="primary" onClick={() => setAddressForm({})}>
            Añadir dirección
          </Button>
        </div>

        {addressActionError ? <p className="font-body text-caption text-estado-error">{addressActionError}</p> : null}

        {addresses.length === 0 ? (
          <button
            type="button"
            onClick={() => setAddressForm({})}
            className="flex flex-col items-center justify-center gap-sm rounded-card-lg border border-dashed border-borde bg-inset p-3xl text-center transition-colors duration-150 hover:border-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
          >
            <Plus size={24} weight="regular" aria-hidden="true" className="text-grafito" />
            <p className="font-ui text-ui text-negro">Añade tu primera dirección</p>
          </button>
        ) : (
          <div className="grid gap-md sm:grid-cols-2">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={() => setAddressForm({ address })}
                onDelete={() => setAddressToDelete(address)}
                onSetDefault={() => void handleSetDefault(address)}
                settingDefault={settingDefaultId === address.id}
              />
            ))}
          </div>
        )}
      </section>

      <AccountCard
        title="Datos de facturación"
        action={
          billingInfo ? (
            <div className="flex gap-sm">
              <Button variant="text" tone="neutral" onClick={() => setEditingBillingInfo(true)}>
                Editar
              </Button>
              <Button variant="text" tone="danger" onClick={() => setConfirmDeleteBillingInfo(true)}>
                Eliminar
              </Button>
            </div>
          ) : null
        }
      >
        {billingInfoError ? <p className="mb-sm font-body text-caption text-estado-error">{billingInfoError}</p> : null}
        {billingInfo ? (
          <dl className="grid gap-md sm:grid-cols-2">
            <div>
              <dt className="font-ui text-caption text-grafito">RFC</dt>
              <dd className="font-body text-body text-negro">{billingInfo.rfc}</dd>
            </div>
            <div>
              <dt className="font-ui text-caption text-grafito">Razón social</dt>
              <dd className="font-body text-body text-negro">{billingInfo.legalName}</dd>
            </div>
            <div>
              <dt className="font-ui text-caption text-grafito">Uso de CFDI</dt>
              <dd className="font-body text-body text-negro">{CFDI_USE_LABELS[billingInfo.cfdiUse]}</dd>
            </div>
            <div>
              <dt className="font-ui text-caption text-grafito">Régimen fiscal</dt>
              <dd className="font-body text-body text-negro">{TAX_REGIME_LABELS[billingInfo.taxRegime]}</dd>
            </div>
            <div>
              <dt className="font-ui text-caption text-grafito">Código postal fiscal</dt>
              <dd className="font-body text-body text-negro">{billingInfo.postalCode}</dd>
            </div>
          </dl>
        ) : (
          <div className="flex flex-col items-start gap-sm">
            <p className="font-body text-body text-grafito">Aún no agregas tus datos fiscales.</p>
            <Button variant="secondary" onClick={() => setEditingBillingInfo(true)}>
              Agregar datos fiscales
            </Button>
          </div>
        )}
      </AccountCard>

      {addressForm ? (
        <AddressForm
          key={addressForm.address?.id ?? "create"}
          initial={addressForm.address}
          onClose={() => setAddressForm(null)}
          onSaved={setAddresses}
        />
      ) : null}

      {editingBillingInfo ? (
        <BillingInfoForm
          initial={billingInfo}
          onClose={() => setEditingBillingInfo(false)}
          onSaved={setBillingInfo}
        />
      ) : null}

      <Modal
        open={addressToDelete !== null}
        onClose={() => setAddressToDelete(null)}
        title="Eliminar dirección"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddressToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={deletingAddress} onClick={() => void handleDeleteAddress()}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        {addressToDelete ? <p>¿Eliminar &quot;{addressToDelete.label}&quot;? Esta acción no se puede deshacer.</p> : null}
      </Modal>

      <Modal
        open={confirmDeleteBillingInfo}
        onClose={() => setConfirmDeleteBillingInfo(false)}
        title="Eliminar datos fiscales"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDeleteBillingInfo(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={deletingBillingInfo} onClick={() => void handleDeleteBillingInfo()}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p>¿Eliminar tus datos fiscales? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
}
