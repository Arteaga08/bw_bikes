"use client";

import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

type Status = "loading" | "verified" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [error, setError] = useState<string | null>(token ? null : "Falta el token de verificación.");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }, { unauthorizedRedirectPath: null })
      .then(() => {
        if (!cancelled) setStatus("verified");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "No se pudo verificar el correo.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend(event: FormEvent): Promise<void> {
    event.preventDefault();
    setResending(true);
    setResendMessage(null);
    try {
      await apiFetch(
        "/auth/resend-verification",
        { method: "POST", body: JSON.stringify({ email: resendEmail }) },
        { unauthorizedRedirectPath: null },
      );
      setResendMessage("Si el correo existe, te enviamos un enlace de verificación.");
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : "No se pudo reenviar el correo.");
    } finally {
      setResending(false);
    }
  }

  if (status === "loading") {
    return <p className="font-body text-body text-grafito">Verificando tu correo…</p>;
  }

  if (status === "verified") {
    return (
      <div className="flex flex-col gap-md">
        <p className="font-body text-body text-grafito">Correo verificado. Ya puedes iniciar sesión.</p>
        <ButtonLink href="/ingresar" variant="primary">
          Iniciar sesión
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {error ? <p className="font-body text-caption text-estado-error">{error}</p> : null}
      <form onSubmit={handleResend} className="flex flex-col gap-md" noValidate>
        <Input
          label="Correo"
          type="email"
          autoComplete="username"
          required
          value={resendEmail}
          onChange={(event) => setResendEmail(event.target.value)}
        />
        <Button type="submit" variant="secondary" loading={resending}>
          Reenviar correo
        </Button>
      </form>
      {resendMessage ? <p className="font-body text-caption text-grafito">{resendMessage}</p> : null}
      <ButtonLink href="/ingresar" variant="text" tone="neutral">
        Ir a iniciar sesión
      </ButtonLink>
    </div>
  );
}

// `useSearchParams` requires a `Suspense` ancestor — this boundary exists
// purely for that; nothing here actually suspends.
export function VerifyEmailClient() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
