"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

const GENERIC_ACK_MESSAGE = "Si el correo existe, te enviamos un enlace.";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    try {
      await apiFetch(
        "/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) },
        { unauthorizedRedirectPath: null },
      );
    } catch (err) {
      // The backend already replies with the same generic message whether or
      // not the account exists — a rejection here (e.g. bad request shape)
      // still shows the same acknowledgment, never a distinguishing error.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return <p className="font-body text-body text-grafito">{GENERIC_ACK_MESSAGE}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
      <Input
        label="Correo"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" variant="primary" loading={loading} className="w-full">
        Enviar
      </Button>
      <ButtonLink href="/ingresar" variant="text" tone="neutral" className="self-center">
        Volver a iniciar sesión
      </ButtonLink>
    </form>
  );
}
