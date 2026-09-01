"use client";

import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { safeRedirectTarget } from "@/lib/auth/customer-redirect";

function loginHrefWithRedirect(redirect: string | null): string {
  return redirect ? `/ingresar?redirect=${encodeURIComponent(redirect)}` : "/ingresar";
}

function CustomerRegisterFormContent() {
  const searchParams = useSearchParams();
  const redirect = safeRedirectTarget(searchParams.get("redirect") ?? undefined);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch(
        "/auth/register",
        { method: "POST", body: JSON.stringify({ firstName, lastName, email, password, passwordConfirm }) },
        { unauthorizedRedirectPath: null },
      );
      setRegistered(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return <p className="font-body text-body text-grafito">Revisa tu correo para verificar tu cuenta.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
      <Input
        label="Nombre"
        autoComplete="given-name"
        required
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
      />
      <Input
        label="Apellido"
        autoComplete="family-name"
        required
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
      />
      <Input
        label="Correo"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        required
        value={passwordConfirm}
        onChange={(event) => setPasswordConfirm(event.target.value)}
      />
      {error ? <p className="font-body text-caption text-estado-error">{error}</p> : null}
      <Button type="submit" variant="primary" loading={loading} className="w-full">
        Crear cuenta
      </Button>
      <ButtonLink href={loginHrefWithRedirect(redirect)} variant="text" tone="neutral" className="self-center">
        ¿Ya tienes cuenta? Inicia sesión
      </ButtonLink>
    </form>
  );
}

// `useSearchParams` requires a `Suspense` ancestor — this boundary exists
// purely for that; nothing here actually suspends.
export function CustomerRegisterForm() {
  return (
    <Suspense fallback={null}>
      <CustomerRegisterFormContent />
    </Suspense>
  );
}
