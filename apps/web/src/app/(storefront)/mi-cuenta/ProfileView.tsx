"use client";

import type { AccountDTO } from "@bw-bikes/shared";
import { useState } from "react";
import { AccountCard } from "@/components/account/AccountCard";
import { PasswordForm } from "@/components/account/PasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Button } from "@/components/ui/Button";

export interface ProfileViewProps {
  initialAccount: AccountDTO;
}

/** `1990-05-10T00:00:00.000Z` → "10 de mayo de 1990". `timeZone: "UTC"` keeps the date-only value from shifting a day in a browser west of UTC. */
function formatBirthDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function ProfileView({ initialAccount }: ProfileViewProps) {
  const [account, setAccount] = useState(initialAccount);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  return (
    <div className="flex flex-col gap-lg">
      <AccountCard
        title="Tu información"
        action={
          <Button variant="text" tone="neutral" onClick={() => setEditingProfile(true)}>
            Editar
          </Button>
        }
      >
        <dl className="grid gap-md sm:grid-cols-2">
          <div>
            <dt className="font-ui text-caption text-grafito">Nombre completo</dt>
            <dd className="font-body text-body text-negro">
              {account.firstName} {account.lastName}
            </dd>
          </div>
          <div>
            <dt className="font-ui text-caption text-grafito">Correo</dt>
            <dd className="font-body text-body text-negro">{account.email}</dd>
          </div>
          <div>
            <dt className="font-ui text-caption text-grafito">Teléfono</dt>
            <dd className="font-body text-body text-negro">{account.phone || "—"}</dd>
          </div>
          <div>
            <dt className="font-ui text-caption text-grafito">Cumpleaños</dt>
            <dd className="font-body text-body text-negro">{formatBirthDate(account.birthDate)}</dd>
          </div>
          <div>
            <dt className="font-ui text-caption text-grafito">Ciudad</dt>
            <dd className="font-body text-body text-negro">{account.city || "—"}</dd>
          </div>
        </dl>
      </AccountCard>

      <AccountCard
        title="Contraseña"
        action={
          <Button variant="text" tone="neutral" onClick={() => setEditingPassword(true)}>
            Editar
          </Button>
        }
      >
        <p className="font-body text-body text-negro">••••••••</p>
      </AccountCard>

      {editingProfile ? (
        <ProfileForm initial={account} onClose={() => setEditingProfile(false)} onSaved={setAccount} />
      ) : null}

      {editingPassword ? <PasswordForm onClose={() => setEditingPassword(false)} /> : null}
    </div>
  );
}
