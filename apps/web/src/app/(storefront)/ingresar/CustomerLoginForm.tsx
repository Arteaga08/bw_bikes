"use client";

import type { AuthUser } from "@bw-bikes/shared";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { CUSTOMER_REGISTER_PATH } from "@/lib/config";
import { safeRedirectTarget } from "@/lib/auth/customer-redirect";

interface LoginSuccessData {
  user: AuthUser;
}

function registerHref(redirect: string | null): string {
  return redirect ? `${CUSTOMER_REGISTER_PATH}?redirect=${encodeURIComponent(redirect)}` : CUSTOMER_REGISTER_PATH;
}

function forgotPasswordHref(redirect: string | null): string {
  return redirect ? `/recuperar-contrasena?redirect=${encodeURIComponent(redirect)}` : "/recuperar-contrasena";
}

function CustomerLoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectTarget(searchParams.get("redirect") ?? undefined);
  const passwordWasReset = searchParams.get("restablecida") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResendMessage(null);
    setLoading(true);
    try {
      await apiFetch<LoginSuccessData>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        { unauthorizedRedirectPath: null },
      );
      router.replace(redirect ?? "/");
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        setNeedsVerification(true);
      }
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(): Promise<void> {
    setResending(true);
    setResendMessage(null);
    try {
      await apiFetch(
        "/auth/resend-verification",
        { method: "POST", body: JSON.stringify({ email }) },
        { unauthorizedRedirectPath: null },
      );
      setResendMessage("Si el correo existe, te enviamos un enlace de verificación.");
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : "No se pudo reenviar el correo.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
      {passwordWasReset ? (
        <p className="font-body text-caption text-grafito">Contraseña actualizada. Ya puedes iniciar sesión.</p>
      ) : null}
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
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <p className="font-body text-caption text-estado-error">{error}</p> : null}
      {needsVerification ? (
        <Button type="button" variant="secondary" loading={resending} onClick={handleResend}>
          Reenviar correo
        </Button>
      ) : null}
      {resendMessage ? <p className="font-body text-caption text-grafito">{resendMessage}</p> : null}
      <Button type="submit" variant="primary" loading={loading} className="w-full">
        Iniciar sesión
      </Button>
      <div className="flex flex-col items-center gap-xs">
        <ButtonLink href={forgotPasswordHref(redirect)} variant="text" tone="neutral">
          ¿Olvidaste tu contraseña?
        </ButtonLink>
        <ButtonLink href={registerHref(redirect)} variant="text" tone="neutral">
          Crear cuenta
        </ButtonLink>
      </div>
    </form>
  );
}

// `useSearchParams` requires a `Suspense` ancestor — this boundary exists
// purely for that; nothing here actually suspends.
export function CustomerLoginForm() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginFormContent />
    </Suspense>
  );
}
