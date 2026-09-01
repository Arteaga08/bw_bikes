"use client";

import { CheckCircle } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

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

  async function handleResend(): Promise<void> {
    setResending(true);
    setResendMessage(null);
    try {
      await apiFetch(
        "/auth/resend-verification",
        { method: "POST", body: JSON.stringify({ email }) },
        { unauthorizedRedirectPath: null },
      );
      setResendMessage("Te enviamos un nuevo enlace de verificación.");
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : "No se pudo reenviar el correo.");
    } finally {
      setResending(false);
    }
  }

  if (registered) {
    return (
      <div className="flex flex-col items-start gap-md">
        <span className="flex items-center gap-xs font-ui text-eyebrow text-grafito uppercase">
          <Image src="/brand/rhino-negro.svg" alt="" width={16} height={16} />
          Cuenta creada
        </span>
        <p className="flex items-center gap-xs font-body text-body text-estado-exito">
          <CheckCircle size={18} weight="regular" aria-hidden="true" className="shrink-0" />
          Revisa tu correo para verificar tu cuenta.
        </p>
        <p className="font-body text-caption text-grafito">
          ¿No te llegó? Puede tardar unos minutos, o revisa spam.
        </p>
        <Button type="button" variant="secondary" size="sm" loading={resending} onClick={handleResend}>
          Reenviar correo
        </Button>
        {resendMessage ? <p className="font-body text-caption text-grafito">{resendMessage}</p> : null}
      </div>
    );
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
        aria-describedby="password-strength"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <PasswordStrengthMeter id="password-strength" password={password} />
      <Input
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        required
        value={passwordConfirm}
        onChange={(event) => setPasswordConfirm(event.target.value)}
      />
      <Checkbox
        label={
          <>
            Acepto los <Link href="/terminos" className="underline underline-offset-2 hover:text-dorado-hover">Términos de uso</Link> y el{" "}
            <Link href="/privacidad" className="underline underline-offset-2 hover:text-dorado-hover">Aviso de privacidad</Link>.
          </>
        }
        required
        checked={termsAccepted}
        onChange={(event) => setTermsAccepted(event.target.checked)}
      />
      {error ? <p className="font-body text-caption text-estado-error">{error}</p> : null}
      <Button type="submit" variant="primary" loading={loading} disabled={!termsAccepted} className="w-full">
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
