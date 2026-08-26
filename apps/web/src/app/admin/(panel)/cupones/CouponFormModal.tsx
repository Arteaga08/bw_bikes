"use client";

import type { AdminCategory, AdminCoupon, CouponScopeKind, CouponType, ItemType } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import { adminAccessoryCategoriesApi, adminBikeCategoriesApi } from "@/lib/api/admin-catalog";
import { adminCouponsApi, type CouponInput } from "@/lib/api/admin-coupons";
import { ApiError } from "@/lib/api/error";

export interface CouponFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  /** Present when editing; absent when creating. */
  initial?: AdminCoupon;
}

interface FormErrors {
  code?: string;
  name?: string;
  value?: string;
  categoryIds?: string;
}

/** Pesos as typed by a human → integer cents. `""` and junk both become `undefined`. */
function pesosToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function centsToPesos(cents: number | undefined): string {
  return cents === undefined ? "" : String(cents / 100);
}

/** A percentage as typed ("10", "12.5") → basis points, which is what the API stores. */
function percentToBps(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 100);
}

function bpsToPercent(bps: number | undefined): string {
  return bps === undefined ? "" : String(bps / 100);
}

/** `2026-08-26T12:00:00.000Z` → `2026-08-26T12:00`, which is what `datetime-local` wants. */
function toDateTimeLocal(iso: string | undefined): string {
  return iso ? iso.slice(0, 16) : "";
}

function fromDateTimeLocal(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

/**
 * Create/edit form for a coupon campaign.
 *
 * Plain `useState` per field and manual validation, like every other form in
 * this panel — there is no form library or resolver in `apps/web`.
 *
 * Two shapes worth noting:
 *
 * 1. **The value field swaps with `type`.** A percentage coupon has a
 *    percentage and an optional ceiling; a fixed-amount one has neither. The
 *    API rejects sending both (`xor`), so the form sends exactly the one the
 *    selected type calls for rather than clearing the other and hoping.
 * 2. **Money and percentages are typed in human units and converted on the
 *    way out.** The API speaks cents and basis points end to end; nobody
 *    should have to type `250000` to mean $2,500.
 */
export function CouponFormModal({ onClose, onSaved, initial }: CouponFormModalProps) {
  const { toast } = useToast();

  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<CouponType>(initial?.type ?? "percent_off");
  const [percent, setPercent] = useState(bpsToPercent(initial?.percentOffBps));
  const [amount, setAmount] = useState(centsToPesos(initial?.amountOffCents));
  const [maxDiscount, setMaxDiscount] = useState(centsToPesos(initial?.maxDiscountCents));
  const [minSubtotal, setMinSubtotal] = useState(centsToPesos(initial?.minSubtotalCents));

  const [scopeKind, setScopeKind] = useState<CouponScopeKind>(initial?.scope.kind ?? "all");
  const [scopeItemType, setScopeItemType] = useState<ItemType>(initial?.scope.itemType ?? "bike");
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.scope.categoryIds ?? []);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [startsAt, setStartsAt] = useState(toDateTimeLocal(initial?.startsAt));
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(initial?.expiresAt));
  const [maxTotal, setMaxTotal] = useState(initial?.maxRedemptionsTotal ? String(initial.maxRedemptionsTotal) : "");
  const [maxPerCustomer, setMaxPerCustomer] = useState(String(initial?.maxRedemptionsPerCustomer ?? 1));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Same "adjust state during render" pattern the list views use: flipping the
  // loading flag inside the effect triggers a cascading render, which the lint
  // rule catches and React would pay for on every catalog switch.
  const categoriesKey = scopeKind === "categories" ? scopeItemType : null;
  const [lastCategoriesKey, setLastCategoriesKey] = useState<string | null>(null);
  if (categoriesKey !== lastCategoriesKey) {
    setLastCategoriesKey(categoriesKey);
    setCategoriesLoading(categoriesKey !== null);
  }

  // Loaded only when the campaign is actually scoped to categories — the two
  // trees are separate collections, so which one to read depends on itemType.
  useEffect(() => {
    if (scopeKind !== "categories") return;
    let cancelled = false;
    const api = scopeItemType === "bike" ? adminBikeCategoriesApi : adminAccessoryCategoriesApi;
    api
      .list({ limit: 100, sort: "name" })
      .then((result) => {
        if (!cancelled) setCategories(result.data);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeKind, scopeItemType]);

  function toggleCategory(id: string): void {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  }

  // Switching catalogs invalidates the picked ids — they belong to the tree
  // that was on screen a moment ago, and the API would reject them.
  function changeScopeItemType(next: ItemType): void {
    setScopeItemType(next);
    setCategoryIds([]);
  }

  function buildInput(): CouponInput {
    const scope =
      scopeKind === "categories"
        ? { kind: scopeKind, itemType: scopeItemType, categoryIds }
        : { kind: scopeKind };

    return {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      type,
      // Exactly one of the two, matching `type` — the API's `xor` rejects both.
      ...(type === "percent_off"
        ? {
            percentOffBps: percentToBps(percent)!,
            ...(pesosToCents(maxDiscount) !== undefined ? { maxDiscountCents: pesosToCents(maxDiscount)! } : {}),
          }
        : { amountOffCents: pesosToCents(amount)! }),
      ...(pesosToCents(minSubtotal) !== undefined ? { minSubtotalCents: pesosToCents(minSubtotal)! } : {}),
      scope,
      ...(fromDateTimeLocal(startsAt) ? { startsAt: fromDateTimeLocal(startsAt)! } : {}),
      ...(fromDateTimeLocal(expiresAt) ? { expiresAt: fromDateTimeLocal(expiresAt)! } : {}),
      ...(maxTotal.trim() ? { maxRedemptionsTotal: Number(maxTotal) } : {}),
      maxRedemptionsPerCustomer: Number(maxPerCustomer) || 1,
      isActive,
    };
  }

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!code.trim()) next.code = "El código es obligatorio.";
    else if (!/^[A-Za-z0-9-]{3,24}$/.test(code.trim())) {
      next.code = "Usa 3 a 24 caracteres: letras, números y guiones.";
    }

    if (!name.trim()) next.name = "El nombre de la campaña es obligatorio.";

    if (type === "percent_off") {
      const bps = percentToBps(percent);
      if (bps === undefined) next.value = "Captura un porcentaje mayor a cero.";
      else if (bps > 10_000) next.value = "El porcentaje no puede exceder 100%.";
    } else if (pesosToCents(amount) === undefined || pesosToCents(amount) === 0) {
      next.value = "Captura un monto mayor a cero.";
    }

    if (scopeKind === "categories" && categoryIds.length === 0) {
      next.categoryIds = "Selecciona al menos una categoría.";
    }

    return next;
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (initial) await adminCouponsApi.update(initial.id, buildInput());
      else await adminCouponsApi.create(buildInput());

      toast({ variant: "success", title: initial ? "Cambios guardados" : "Cupón creado" });
      onSaved();
      onClose();
    } catch (error) {
      // The API's refusals already arrive in Spanish and are actionable
      // ("Ya existe un cupón con el código …") — shown verbatim.
      toast({
        variant: "error",
        title: "No se pudo guardar el cupón",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
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
      title={initial ? "Editar cupón" : "Nuevo cupón"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Código"
            placeholder="BUENFIN20"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            error={errors.code}
            helper="Lo que teclea el cliente. Letras, números y guiones."
          />
          <Input
            label="Nombre de la campaña"
            placeholder="Buen Fin 2026"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            helper="Solo para ti. El cliente nunca lo ve."
          />
        </div>

        <div className="grid gap-md sm:grid-cols-2">
          <Select label="Tipo de descuento" value={type} onChange={(event) => setType(event.target.value as CouponType)}>
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
              placeholder="10"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              error={errors.value}
              helper="10 = 10% de descuento."
            />
          ) : (
            <Input
              label="Monto en pesos"
              type="number"
              min="0"
              step="1"
              placeholder="500"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              error={errors.value}
              helper="Nunca descuenta más de lo que hay en el carrito."
            />
          )}
        </div>

        <div className="grid gap-md sm:grid-cols-2">
          {type === "percent_off" ? (
            <Input
              label="Tope de descuento (opcional)"
              type="number"
              min="0"
              step="1"
              placeholder="5000"
              value={maxDiscount}
              onChange={(event) => setMaxDiscount(event.target.value)}
              helper="Sin tope, un 20% descuenta $40,000 de una bici de $200,000."
            />
          ) : null}
          <Input
            label="Compra mínima (opcional)"
            type="number"
            min="0"
            step="1"
            placeholder="5000"
            value={minSubtotal}
            onChange={(event) => setMinSubtotal(event.target.value)}
            helper="Se mide contra el total del carrito."
          />
        </div>

        <div className="grid gap-md sm:grid-cols-2">
          <Select
            label="Aplica a"
            value={scopeKind}
            onChange={(event) => setScopeKind(event.target.value as CouponScopeKind)}
          >
            <option value="all">Todo el catálogo</option>
            <option value="bikes">Solo bicicletas</option>
            <option value="accessories">Solo accesorios</option>
            <option value="categories">Categorías específicas</option>
          </Select>

          {scopeKind === "categories" ? (
            <Select
              label="Catálogo"
              value={scopeItemType}
              onChange={(event) => changeScopeItemType(event.target.value as ItemType)}
              helper="Bicicletas y accesorios tienen árboles de categorías separados."
            >
              <option value="bike">Bicicletas</option>
              <option value="accessory">Accesorios</option>
            </Select>
          ) : null}
        </div>

        {scopeKind === "categories" ? (
          <fieldset className="rounded-card border border-borde p-md">
            <legend className="px-xs font-ui text-caption text-grafito">Categorías</legend>
            {categoriesLoading ? (
              <p className="font-body text-caption text-grafito">Cargando categorías…</p>
            ) : categories.length === 0 ? (
              <p className="font-body text-caption text-grafito">No hay categorías en este catálogo.</p>
            ) : (
              <div className="grid gap-xs sm:grid-cols-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-sm font-body text-ui text-negro">
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            )}
            {errors.categoryIds ? (
              <p className="mt-xs font-body text-caption text-error">{errors.categoryIds}</p>
            ) : null}
          </fieldset>
        ) : null}

        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Vigente desde (opcional)"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <Input
            label="Expira (opcional)"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>

        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Límite total de canjes (opcional)"
            type="number"
            min="1"
            step="1"
            placeholder="Sin límite"
            value={maxTotal}
            onChange={(event) => setMaxTotal(event.target.value)}
            helper="Acota cuánto puede costarte la campaña completa."
          />
          <Input
            label="Canjes por cliente"
            type="number"
            min="1"
            step="1"
            value={maxPerCustomer}
            onChange={(event) => setMaxPerCustomer(event.target.value)}
            helper="Impide que una sola persona agote la campaña."
          />
        </div>

        <div className="flex flex-col gap-xs">
          <Toggle label="Cupón activo" checked={isActive} onChange={setIsActive} />
          <p className="font-body text-caption text-grafito">
            Desactívalo para dejar de aceptarlo sin borrar su historial de canjes.
          </p>
        </div>
      </div>
    </Modal>
  );
}
