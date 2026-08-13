"use client";

import type { AuthUser } from "@bw-bikes/shared";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { PANEL_HOME_PATH } from "@/lib/config";

// Mirrors apps/api/src/config/auth.ts's TWO_FACTOR_CHALLENGE_TTL_MS — the
// challenge cookie the backend issues after a correct password really does
// expire in 5 minutes; this is only used to proactively reset the form
// before that happens, never as the source of truth (the backend rejects
// an expired cookie regardless of what this timer thinks).
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type Step = "credentials" | "totp" | "enroll";

interface TwoFactorRequiredData {
  twoFactorRequired: true;
  enrolled: boolean;
}

interface LoginSuccessData {
  user: AuthUser;
}

type LoginResponseData = TwoFactorRequiredData | LoginSuccessData;

interface EnrollmentSetup {
  secret: string;
  otpauthUrl: string;
}

function isTwoFactorRequired(
  data: LoginResponseData,
): data is TwoFactorRequiredData {
  return "twoFactorRequired" in data;
}

export function LoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentSetup | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [challengeExpiresAt, setChallengeExpiresAt] = useState<number | null>(
    null,
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Declared before the effect that calls it (react-hooks/immutability wants
  // effects to only close over values whose reference is already
  // established, not one that's hoisted from later in the source) and
  // memoized so the effect below doesn't need it in its dependency array.
  const resetToCredentials = useCallback((message: string) => {
    setStep("credentials");
    setPassword("");
    setTotpCode("");
    setEnrollment(null);
    setQrDataUrl(null);
    setChallengeExpiresAt(null);
    setError(message);
  }, []);

  // Countdown for the 5-minute challenge window (totp/enroll steps only).
  // Resetting to "credentials" here is a UX nicety, not the security
  // control — the backend still rejects the cookie once it's actually gone.
  // No setState on the "disabled" branch: `remainingSeconds` only matters
  // while the totp/enroll UI is showing, and `resetToCredentials` already
  // clears the fields that hide it (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (challengeExpiresAt === null) return;
    const expiresAt = challengeExpiresAt;

    function tick(): void {
      const remaining = Math.max(
        0,
        Math.round((expiresAt - Date.now()) / 1000),
      );
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        resetToCredentials(
          "Tu sesión de verificación expiró. Inicia sesión de nuevo.",
        );
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [challengeExpiresAt, resetToCredentials]);

  function goToPanel(): void {
    router.replace(PANEL_HOME_PATH);
  }

  async function handleCredentialsSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiFetch<LoginResponseData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!isTwoFactorRequired(data)) {
        goToPanel();
        return;
      }

      setChallengeExpiresAt(Date.now() + CHALLENGE_TTL_MS);

      if (data.enrolled) {
        setStep("totp");
        return;
      }

      const { data: setup } = await apiFetch<EnrollmentSetup>(
        "/auth/2fa/enroll/start",
        { method: "POST" },
      );
      setEnrollment(setup);
      setStep("enroll");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch<LoginSuccessData>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ totpCode }),
      });
      goToPanel();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo verificar el código.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrollSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch<LoginSuccessData>("/auth/2fa/enroll/complete", {
        method: "POST",
        body: JSON.stringify({ totpCode }),
      });
      goToPanel();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo activar la autenticación de dos factores.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Renders the QR from the otpauth:// URI once, client-side, closing the
  // pending item M2 explicitly left for M8 ("the dashboard renders it").
  // No setState on the "nothing to render" branch — `resetToCredentials`
  // already clears `qrDataUrl` on every path that leaves the enroll step.
  useEffect(() => {
    if (!enrollment) return;
    let cancelled = false;
    QRCode.toDataURL(enrollment.otpauthUrl, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enrollment]);

  if (step === "credentials") {
    return (
      <form
        onSubmit={handleCredentialsSubmit}
        className="flex flex-col gap-md"
        noValidate
      >
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
        {error ? (
          <p className="font-body text-caption text-estado-error">{error}</p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          Iniciar sesión
        </Button>
      </form>
    );
  }

  if (step === "enroll") {
    return (
      <form
        onSubmit={handleEnrollSubmit}
        className="flex flex-col gap-md"
        noValidate
      >
        <p className="font-body text-body text-grafito">
          Configura la autenticación de dos factores escaneando este código con
          tu aplicación de autenticación (Google Authenticator, 1Password,
          Authy).
        </p>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a locally generated data: URL, not a remote/optimizable image
          <img
            src={qrDataUrl}
            alt="Código QR para configurar la autenticación de dos factores"
            width={220}
            height={220}
            className="self-center"
          />
        ) : null}
        {enrollment ? (
          <p className="break-all rounded-control border border-borde bg-base p-sm font-body text-caption text-grafito">
            Clave manual: {enrollment.secret}
          </p>
        ) : null}
        <Input
          label="Código de verificación"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={totpCode}
          onChange={(event) => setTotpCode(event.target.value)}
          helper={
            remainingSeconds !== null
              ? `Expira en ${remainingSeconds}s`
              : undefined
          }
        />
        {error ? (
          <p className="font-body text-caption text-estado-error">{error}</p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          Activar y entrar
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleTotpSubmit}
      className="flex flex-col gap-md"
      noValidate
    >
      <p className="font-body text-body text-grafito">
        Ingresa el código de 6 dígitos de tu aplicación de autenticación.
      </p>
      <Input
        label="Código de verificación"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={totpCode}
        onChange={(event) => setTotpCode(event.target.value)}
        helper={
          remainingSeconds !== null
            ? `Expira en ${remainingSeconds}s`
            : undefined
        }
      />
      {error ? (
        <p className="font-body text-caption text-estado-error">{error}</p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        loading={loading}
        className="w-full"
      >
        Verificar
      </Button>
    </form>
  );
}
