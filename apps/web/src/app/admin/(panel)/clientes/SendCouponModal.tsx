"use client";

import type { AdminCoupon, CouponType } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/use-toast";
import { adminCouponsApi } from "@/lib/api/admin-coupons";
import { adminCustomersApi } from "@/lib/api/admin-customers";
import { ApiError } from "@/lib/api/error";

const MAX_MESSAGE_LENGTH = 600;

/** Which of the two flows the admin is using. */
type Mode = "existente" | "nuevo";

export interface SendCouponModalProps {
  /** Ids of the selected customers. Length drives the copy and which flows are offered. */
  userIds: string[];
  onClose: () => void;
  onSent: () => void;
}

function pesosToCents(value: string): number | undefined {
  const parsed = Number(value.trim());
  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 100);
}

function percentToBps(value: string): number | undefined {
  const parsed = Number(value.trim());
  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 100);
}

/**
 * The two ways to get a coupon in front of a customer (M21).
 *
 * **"Generar al vuelo" is single-customer only, and that is a property of the
 * coupon model rather than a UI shortcut.** A generated code is capped at one
 * redemption globally, which is what makes it personal — the shared-code model
 * has no notion of an owner. Minting one code and mailing it to forty people
 * would mean thirty-nine of them get a code the first person already spent.
 */
export function SendCouponModal({ userIds, onClose, onSent }: SendCouponModalProps) {
  const { toast } = useToast();
  const single = userIds.length === 1;

  const [mode, setMode] = useState<Mode>("existente");
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [couponId, setCouponId] = useState("");
  const [message, setMessage] = useState("");

  const [type, setType] = useState<CouponType>("percent_off");
  const [percent, setPercent] = useState("10");
  const [amount, setAmount] = useState("500");
  const [expiresAt, setExpiresAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Only active campaigns: the API refuses to send a deactivated or expired
  // one, so offering them here would be a dead end the admin only discovers
  // after pressing the button.
  useEffect(() => {
    let cancelled = false;
    adminCouponsApi
      .list({ limit: 100, isActive: true, sort: "-createdAt" })
      .then((result) => {
        if (cancelled) return;
        setCoupons(result.data);
        setCouponId((current) => current || (result.data[0]?.id ?? ""));
      })
      .catch(() => {
        if (!cancelled) setCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(): Promise<void> {
    setError(undefined);

    if (mode === "existente" && !couponId) {
      setError("Selecciona un cupón.");
      return;
    }
    if (mode === "nuevo") {
      const value = type === "percent_off" ? percentToBps(percent) : pesosToCents(amount);
      if (value === undefined) {
        setError("Captura un descuento mayor a cero.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "existente") {
        const outcome = await adminCouponsApi.send(couponId, {
          userIds,
          ...(message.trim() ? { message: message.trim() } : {}),
        });

        // A partial failure is a normal batch outcome, not an error — the
        // toast reports both halves rather than claiming success or failure.
        const { sent, failed, skipped } = outcome.summary;
        const problems = failed + skipped;
        toast({
          variant: problems > 0 ? "warning" : "success",
          title: `${sent} cupón(es) enviado(s)`,
          ...(problems > 0 ? { description: `${failed} fallaron, ${skipped} omitidos.` } : {}),
        });
      } else {
        const coupon = await adminCustomersApi.generateCoupon(userIds[0]!, {
          type,
          ...(type === "percent_off"
            ? { percentOffBps: percentToBps(percent)! }
            : { amountOffCents: pesosToCents(amount)! }),
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
          ...(message.trim() ? { message: message.trim() } : {}),
        });
        toast({ variant: "success", title: `Cupón ${coupon.code} generado y enviado` });
      }

      onSent();
      onClose();
    } catch (caught) {
      toast({
        variant: "error",
        title: "No se pudo enviar",
        description: caught instanceof ApiError ? caught.message : "Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={single ? "Enviar cupón" : `Enviar cupón a ${userIds.length} clientes`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Enviar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {single ? (
          <Select label="Qué mandar" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="existente">Un cupón existente</option>
            <option value="nuevo">Generar uno nuevo para este cliente</option>
          </Select>
        ) : null}

        {mode === "existente" ? (
          coupons.length === 0 ? (
            <p className="font-body text-ui text-grafito">
              No hay cupones activos. Crea uno en la sección de Cupones antes de enviarlo.
            </p>
          ) : (
            <Select
              label="Cupón"
              value={couponId}
              onChange={(event) => setCouponId(event.target.value)}
              error={error}
              helper="Solo se listan campañas activas."
            >
              {coupons.map((coupon) => (
                <option key={coupon.id} value={coupon.id}>
                  {coupon.code} — {coupon.name}
                </option>
              ))}
            </Select>
          )
        ) : (
          <>
            <p className="font-body text-caption text-grafito">
              Se genera un código único de un solo uso, con el nombre de este cliente.
            </p>
            <div className="grid gap-md sm:grid-cols-2">
              <Select
                label="Tipo de descuento"
                value={type}
                onChange={(event) => setType(event.target.value as CouponType)}
              >
                <option value="percent_off">Porcentaje</option>
                <option value="amount_off">Monto fijo</option>
              </Select>
              {type === "percent_off" ? (
                <Input
                  label="Porcentaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                  error={error}
                />
              ) : (
                <Input
                  label="Monto en pesos"
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  error={error}
                />
              )}
            </div>
            <Input
              label="Expira (opcional)"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </>
        )}

        <Textarea
          label="Mensaje (opcional)"
          placeholder="Gracias por tu preferencia…"
          rows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          helper={`Texto plano, se envía tal cual. ${MAX_MESSAGE_LENGTH - message.length} caracteres restantes.`}
        />
      </div>
    </Modal>
  );
}
