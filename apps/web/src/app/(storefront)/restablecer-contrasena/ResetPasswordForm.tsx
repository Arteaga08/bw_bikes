"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

function ResetPasswordFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch(
        "/auth/reset-password",
        { method: "POST", body: JSON.stringify({ token, password, passwordConfirm }) },
        { unauthorizedRedirectPath: null },
      );
      router.replace("/ingresar?restablecida=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
      <Input
        label="Nueva contraseña"
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
      {error ? <p className="font-body text-caption text-estado-error">{error}</p> : null}
      <Button type="submit" variant="primary" loading={loading} className="w-full">
        Restablecer contraseña
      </Button>
    </form>
  );
}

// `useSearchParams` requires a `Suspense` ancestor — this boundary exists
// purely for that; nothing here actually suspends.
export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormContent />
    </Suspense>
  );
}
