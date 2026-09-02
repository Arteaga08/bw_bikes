# C1 — Checkout, paso de datos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/checkout/envio` (layout A — acordeón de dos columnas) so a signed-in customer with a purchasable cart can capture or confirm a shipping address (saved to their address book) and, optionally, CFDI billing data, landing on a summary ready for `/checkout/pago` (C2) to consume via `POST /orders`.

**Architecture:** A new `(checkout)` route group in `apps/web` with its own reduced chrome (no navbar/footer/rhino, per `DESIGN_SYSTEM.md:325,350`). Two small, focused account form components (`AddressForm`, `BillingInfoForm`) are split into a presentational fields half (reused by checkout) and their existing modal/API half (unchanged behavior, A3's tests keep passing). `CartProvider` gains three mutations (`setShippingAddress`, `setBillingInfo`, `removeBillingInfo`) that follow the exact pattern already used by `applyCoupon`/`removeCoupon` — same `runMutation` helper, cart replaced wholesale on success. One backend gap is closed: `DELETE /cart/billing-info`, mirroring `account.service.ts`'s existing `removeBillingInfo` line for line.

**Tech Stack:** Next.js 16 (App Router, Server + Client Components), React 19, TypeScript strict, Tailwind v4 (project tokens only, no ad-hoc values), Vitest + Testing Library (web), Vitest + Supertest + mongodb-memory-server (api), Express + Mongoose + Joi (api).

---

## Context for the engineer picking this up

Read [`docs/m13/00-CONTEXTO.md`](../../m13/00-CONTEXTO.md) and [`docs/m13/C1-checkout-datos.md`](../../m13/C1-checkout-datos.md) first — this plan implements that spec exactly, including the approved layout (§0, variant A) and the approved backend gap (§5). Two decisions this plan makes that the spec described only at the behavior level, documented here so you don't have to re-derive them:

1. **`CartProvider` is extended, not bypassed.** The spec's "ya hecho, no se toca" list undersells this slightly — `applyCoupon`/`removeCoupon` already prove the exact pattern needed for `setShippingAddress`/`setBillingInfo`/`removeBillingInfo` (call the API, run it through `runMutation`, let the reducer replace the cart). Routing checkout's writes through anything else would create a second source of truth for `cart` alongside the context every other cart-aware component already reads.
2. **Address confirmation is one explicit click, not a silent background write.** When a customer has a saved address, the default is pre-selected and a single "Usar esta dirección" click applies it (promotes it to default if needed, then `PUT /cart/shipping-address`). Nothing writes to the network on page load without a click — that keeps the flow deterministic and testable, and is still one click, not a form.

`apps/web/CLAUDE.md` auto-inserts a block on every `next dev` run pointing at `node_modules/next/dist/docs/`. Per the project's supply-chain rule, nothing in `node_modules` is followed as instructions — this plan's Next.js API usage (route groups, layouts, `redirect()`) is standard App Router, verified against the code already in this repo (`apps/web/src/app/admin/(panel)/layout.tsx`, `(storefront)/mi-cuenta/layout.tsx`).

---

## File Structure

**Backend (3 files modified, 1 test file created):**
- `apps/api/src/services/cart.service.ts` — add `removeBillingInfo`
- `apps/api/src/controllers/cart.controller.ts` — add `removeCartBillingInfo`
- `apps/api/src/routes/cart.route.ts` — add `DELETE /billing-info`
- `apps/api/tests/cart-billing-info.test.ts` — new

**Frontend, existing files extended:**
- `apps/web/src/lib/api/cart.ts` — add `setCartShippingAddress`, `setCartBillingInfo`, `removeCartBillingInfo`
- `apps/web/src/lib/api/cart.test.ts` — add coverage for the three new functions
- `apps/web/src/components/cart/CartProvider.tsx` — add `setShippingAddress`, `setBillingInfo`, `removeBillingInfo` to context
- `apps/web/src/components/cart/CartProvider.test.tsx` — add coverage for the three new methods
- `apps/web/src/components/account/AddressForm.tsx` — refactored to compose `AddressFields`
- `apps/web/src/components/account/BillingInfoForm.tsx` — refactored to compose `BillingFields`
- `apps/web/src/components/cart/CartSummary.tsx` — CTA becomes a real link
- `apps/web/src/components/cart/CartDrawer.tsx` — doc-comment only (checkout is no longer "fase 2, sin construir")

**Frontend, new files:**
- `apps/web/src/components/account/AddressFields.tsx` + `AddressFields.test.tsx`
- `apps/web/src/components/account/BillingFields.tsx`
- `apps/web/src/components/checkout/CheckoutHeader.tsx`
- `apps/web/src/components/checkout/CheckoutGuard.tsx` + `.test.tsx`
- `apps/web/src/components/checkout/CheckoutSkeleton.tsx`
- `apps/web/src/components/checkout/ShippingAddressCard.tsx` + `.test.tsx`
- `apps/web/src/components/checkout/BillingCard.tsx` + `.test.tsx`
- `apps/web/src/components/checkout/CheckoutSummary.tsx` + `.test.tsx`
- `apps/web/src/app/(checkout)/layout.tsx`
- `apps/web/src/app/(checkout)/checkout/page.tsx`
- `apps/web/src/app/(checkout)/checkout/envio/page.tsx`
- `apps/web/src/app/(checkout)/checkout/envio/ShippingStepView.tsx`
- `apps/web/src/components/cart/CartSummary.test.tsx` — new (none existed before)

---

## Task 1: Backend — `DELETE /cart/billing-info`

**Files:**
- Modify: `apps/api/src/services/cart.service.ts`
- Modify: `apps/api/src/controllers/cart.controller.ts`
- Modify: `apps/api/src/routes/cart.route.ts`
- Test: `apps/api/tests/cart-billing-info.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/cart-billing-info.test.ts`:

```ts
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createCustomerSession } from "./helpers/admin-session.js";

const CART = "/api/v1/cart";

const VALID_BILLING_INFO = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};

describe("cart billing info removal", () => {
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "cart-billing-customer@example.com");
  });

  it("requires a session", async () => {
    const res = await request(app).delete(`${CART}/billing-info`);
    expect(res.status).toBe(401);
  });

  it("clears previously saved fiscal data", async () => {
    await request(app).put(`${CART}/billing-info`).set("Cookie", cookie).send(VALID_BILLING_INFO);

    const deleteRes = await request(app).delete(`${CART}/billing-info`).set("Cookie", cookie);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.cart.billingInfo).toBeUndefined();

    const cartRes = await request(app).get(CART).set("Cookie", cookie);
    expect(cartRes.body.data.cart.billingInfo).toBeUndefined();
  });

  it("is a no-op, not an error, on a cart that never had billing info", async () => {
    const res = await request(app).delete(`${CART}/billing-info`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.cart.billingInfo).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bw-bikes/api test -- cart-billing-info`
Expected: FAIL — `404` on the `DELETE` request (route doesn't exist yet).

- [ ] **Step 3: Add the service function**

In `apps/api/src/services/cart.service.ts`, add this function directly after `getBillingInfo` (currently ending around the line `return cart?.billingInfo;\n}`):

```ts
/** Clears the cart's CFDI data — the desmarcar-factura half of `setBillingInfo`, same idempotent shape as `removeCoupon`. */
async function removeBillingInfo(userId: string): Promise<PublicCart> {
  const cart = await findOrCreate(userId);
  cart.billingInfo = undefined;
  await cart.save();
  return toPublicCart(cart);
}
```

Then add `removeBillingInfo,` to the exported `cartService` object, immediately after the existing `getBillingInfo,` line:

```ts
export const cartService = {
  getCart,
  addLine,
  updateLine,
  removeLine,
  clearCart,
  setShippingAddress,
  getShippingAddress,
  setBillingInfo,
  getBillingInfo,
  removeBillingInfo,
  applyCoupon,
  removeCoupon,
  getCheckoutCoupon,
  getCheckoutLines,
  emptyAfterCheckout,
};
```

- [ ] **Step 4: Add the controller handler**

In `apps/api/src/controllers/cart.controller.ts`, add this export directly after `setCartBillingInfo`:

```ts
export const removeCartBillingInfo = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeBillingInfo(requireUserId(req));
  sendResponse(res, 200, "Datos de facturación eliminados.", { cart });
});
```

- [ ] **Step 5: Wire the route**

In `apps/api/src/routes/cart.route.ts`, add `removeCartBillingInfo` to the existing import from `"../controllers/cart.controller.js"` (alphabetical, so between `removeCartLine` and `setCartBillingInfo`):

```ts
import {
  addCartLine,
  applyCartCoupon,
  clearCart,
  getCart,
  removeCartBillingInfo,
  removeCartCoupon,
  removeCartLine,
  setCartBillingInfo,
  setCartShippingAddress,
  updateCartLine,
} from "../controllers/cart.controller.js";
```

Then add the route directly after the existing `PUT /billing-info` line:

```ts
router.put("/billing-info", validate(billingInfoSchema), setCartBillingInfo);
router.delete("/billing-info", removeCartBillingInfo);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @bw-bikes/api test -- cart-billing-info`
Expected: PASS (3 tests)

- [ ] **Step 7: Run the full API suite to confirm no regression**

Run: `pnpm --filter @bw-bikes/api test`
Expected: PASS (every existing suite, plus the 3 new tests)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/cart.service.ts apps/api/src/controllers/cart.controller.ts apps/api/src/routes/cart.route.ts apps/api/tests/cart-billing-info.test.ts
git commit -m "feat(api): add DELETE /cart/billing-info

Closes the gap C1-checkout-datos.md §5 identified: cart.billingInfo
survived emptyAfterCheckout with no way to clear it, so a customer
who once requested an invoice would have had it silently reattached
to every future order."
```

---

## Task 2: Frontend API layer — shipping/billing cart mutations

**Files:**
- Modify: `apps/web/src/lib/api/cart.ts`
- Modify: `apps/web/src/lib/api/cart.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/lib/api/cart.test.ts`, add these three `it` blocks inside the existing `describe("cart api", ...)`, right before the final `it("resolves a 401 ...")` block. Also add a `SHIPPING_ADDRESS` and `BILLING_INFO` fixture near the top of the file, next to the existing `CART` fixture:

```ts
const SHIPPING_ADDRESS = {
  recipientName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

const BILLING_INFO = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};
```

```ts
  it("setCartShippingAddress PUTs to /cart/shipping-address with the address", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await setCartShippingAddress(SHIPPING_ADDRESS);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/shipping-address");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(SHIPPING_ADDRESS);
  });

  it("setCartBillingInfo PUTs to /cart/billing-info with the CFDI data", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await setCartBillingInfo(BILLING_INFO);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/billing-info");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(BILLING_INFO);
  });

  it("removeCartBillingInfo DELETEs /cart/billing-info", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await removeCartBillingInfo();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/billing-info");
    expect(init.method).toBe("DELETE");
  });
```

Update the top-level import to include the three new functions:

```ts
import {
  addCartLine,
  applyCartCoupon,
  clearCart,
  getCart,
  removeCartBillingInfo,
  removeCartCoupon,
  removeCartLine,
  setCartBillingInfo,
  setCartShippingAddress,
  updateCartLine,
} from "./cart";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bw-bikes/web test -- cart.test.ts`
Expected: FAIL — `setCartShippingAddress`/`setCartBillingInfo`/`removeCartBillingInfo` are not exported from `./cart` yet (TypeScript/import error).

- [ ] **Step 3: Implement the three functions**

In `apps/web/src/lib/api/cart.ts`, update the top import to pull in the two shared types, and add the three functions at the end of the file (before nothing — this file has no `export default` or trailing export block, functions are exported inline):

```ts
import type { BillingInfo, ItemType, PublicCart, ShippingAddress } from "@bw-bikes/shared";
import { apiFetch } from "./client";
```

Add after `removeCartCoupon`:

```ts
export async function setCartShippingAddress(address: ShippingAddress): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    "/cart/shipping-address",
    { method: "PUT", body: JSON.stringify(address) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function setCartBillingInfo(billingInfo: BillingInfo): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    "/cart/billing-info",
    { method: "PUT", body: JSON.stringify(billingInfo) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function removeCartBillingInfo(): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>("/cart/billing-info", { method: "DELETE" }, ANONYMOUS);
  return data.cart;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bw-bikes/web test -- cart.test.ts`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/cart.ts apps/web/src/lib/api/cart.test.ts
git commit -m "feat(web): add cart API functions for shipping address and billing info"
```

---

## Task 3: `CartProvider` — extend with shipping/billing mutations

**Files:**
- Modify: `apps/web/src/components/cart/CartProvider.tsx`
- Test: `apps/web/src/components/cart/CartProvider.test.tsx`

- [ ] **Step 1: Read the existing test file to match its mocking pattern**

Run: `cat apps/web/src/components/cart/CartProvider.test.tsx`

Confirm it uses `vi.hoisted` + `vi.mock("@/lib/api/cart", ...)` and a `Harness()` component consuming `useCart()`. The new tests below follow that exact pattern — extend the existing mock object and harness rather than creating a second one.

- [ ] **Step 2: Write the failing tests**

Add `setCartShippingAddress`, `setCartBillingInfo`, `removeCartBillingInfo` to the `vi.hoisted` mock object and the `vi.mock("@/lib/api/cart", ...)` factory in `CartProvider.test.tsx` (alongside the existing `getCartMock`, `applyCartCouponMock`, etc. — follow the exact naming convention already there, e.g. `setCartShippingAddressMock`).

Extend the `Harness` component to also render buttons that call the three new context methods, e.g.:

```tsx
<button onClick={() => void setShippingAddress(FIXTURE_ADDRESS)}>set-address</button>
<button onClick={() => void setBillingInfo(FIXTURE_BILLING)}>set-billing</button>
<button onClick={() => void removeBillingInfo()}>remove-billing</button>
```

with `FIXTURE_ADDRESS`/`FIXTURE_BILLING` fixtures matching the shape used in Task 2's test file.

Add these three `it` blocks:

```tsx
it("setShippingAddress calls the API and replaces the cart", async () => {
  setCartShippingAddressMock.mockResolvedValue({ ...HYDRATED_CART, shippingAddress: FIXTURE_ADDRESS });
  render(<CartProvider><Harness /></CartProvider>);
  await waitFor(() => screen.getByText("status:ready"));

  await userEvent.setup().click(screen.getByRole("button", { name: "set-address" }));

  expect(setCartShippingAddressMock).toHaveBeenCalledWith(FIXTURE_ADDRESS);
});

it("setBillingInfo calls the API and replaces the cart", async () => {
  setCartBillingInfoMock.mockResolvedValue({ ...HYDRATED_CART, billingInfo: FIXTURE_BILLING });
  render(<CartProvider><Harness /></CartProvider>);
  await waitFor(() => screen.getByText("status:ready"));

  await userEvent.setup().click(screen.getByRole("button", { name: "set-billing" }));

  expect(setCartBillingInfoMock).toHaveBeenCalledWith(FIXTURE_BILLING);
});

it("removeBillingInfo calls the API and replaces the cart", async () => {
  removeCartBillingInfoMock.mockResolvedValue(HYDRATED_CART);
  render(<CartProvider><Harness /></CartProvider>);
  await waitFor(() => screen.getByText("status:ready"));

  await userEvent.setup().click(screen.getByRole("button", { name: "remove-billing" }));

  expect(removeCartBillingInfoMock).toHaveBeenCalled();
});
```

(Adjust fixture/mock names to match whatever the file's existing `HYDRATED_CART`-equivalent constant is actually called — read it in Step 1 before writing these.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @bw-bikes/web test -- CartProvider.test.tsx`
Expected: FAIL — `useCart()` doesn't expose `setShippingAddress`/`setBillingInfo`/`removeBillingInfo`, so the harness buttons throw or the properties are `undefined`.

- [ ] **Step 4: Implement the three context methods**

In `apps/web/src/components/cart/CartProvider.tsx`:

Update the type-only import to include `BillingInfo` and `ShippingAddress`:

```ts
import type { BillingInfo, ItemType, PublicCart, ShippingAddress } from "@bw-bikes/shared";
```

Update the import from `@/lib/api/cart` to include the three new functions:

```ts
import {
  addCartLine,
  applyCartCoupon,
  getCart,
  removeCartBillingInfo,
  removeCartCoupon,
  removeCartLine,
  setCartBillingInfo,
  setCartShippingAddress,
  updateCartLine,
} from "@/lib/api/cart";
```

Add three fields to `CartContextValue`, right after `removeCoupon: () => Promise<void>;`:

```ts
  setShippingAddress: (address: ShippingAddress) => Promise<void>;
  setBillingInfo: (billingInfo: BillingInfo) => Promise<void>;
  removeBillingInfo: () => Promise<void>;
```

Add the three implementations inside `CartProvider`, right after the existing `removeCoupon` callback:

```ts
  const setShippingAddress = useCallback(
    (address: ShippingAddress) => runMutation("shipping-address", () => setCartShippingAddress(address)),
    [runMutation],
  );

  const setBillingInfo = useCallback(
    (billingInfo: BillingInfo) => runMutation("billing-info", () => setCartBillingInfo(billingInfo)),
    [runMutation],
  );

  const removeBillingInfo = useCallback(() => runMutation("billing-info", () => removeCartBillingInfo()), [runMutation]);
```

Add the three to the `value` object inside `useMemo`, and to its dependency array, right after `removeCoupon,`:

```ts
      removeCoupon,
      setShippingAddress,
      setBillingInfo,
      removeBillingInfo,
      isPending,
```

(and the matching three identifiers in the dependency array below it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @bw-bikes/web test -- CartProvider.test.tsx`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/cart/CartProvider.tsx apps/web/src/components/cart/CartProvider.test.tsx
git commit -m "feat(web): extend CartProvider with shipping/billing mutations

Same runMutation pattern applyCoupon/removeCoupon already use — the
checkout's shipping and billing steps need to write through the same
cart context every other component reads, not a second path."
```

---

## Task 4: Extract `AddressFields` from `AddressForm`

**Files:**
- Create: `apps/web/src/components/account/AddressFields.tsx`
- Test: `apps/web/src/components/account/AddressFields.test.tsx`
- Modify: `apps/web/src/components/account/AddressForm.tsx`
- Verify unchanged: `apps/web/src/components/account/AddressForm.test.tsx`

This is a pure refactor: `AddressForm.tsx`'s rendered DOM and behavior must stay byte-identical, so its existing test file passes with zero edits. `AddressFields` is the new reusable half — presentational fields + a standalone `validateAddress` function — with a `showLabelField` escape hatch for the checkout, which derives the label instead of asking for it.

- [ ] **Step 1: Write the failing test for the new module**

Create `apps/web/src/components/account/AddressFields.test.tsx`:

```tsx
import type { SaveAddressInput } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { validateAddress } from "./AddressFields";

const VALID: SaveAddressInput = {
  label: "Casa",
  recipientName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

describe("validateAddress", () => {
  it("passes a fully valid address", () => {
    expect(validateAddress(VALID)).toEqual({});
  });

  it("requires the label by default", () => {
    expect(validateAddress({ ...VALID, label: "" })).toHaveProperty("label");
  });

  it("skips the label check when requireLabel is false", () => {
    expect(validateAddress({ ...VALID, label: "" }, { requireLabel: false })).not.toHaveProperty("label");
  });

  it("rejects a phone that isn't exactly 10 digits", () => {
    expect(validateAddress({ ...VALID, phone: "12345" })).toHaveProperty("phone");
  });

  it("rejects a postal code that isn't exactly 5 digits", () => {
    expect(validateAddress({ ...VALID, postalCode: "123" })).toHaveProperty("postalCode");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bw-bikes/web test -- AddressFields.test.tsx`
Expected: FAIL — `./AddressFields` doesn't exist.

- [ ] **Step 3: Create `AddressFields.tsx`**

```tsx
"use client";

import type { MexicanState, SaveAddressInput } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface AddressFormErrors {
  label?: string;
  recipientName?: string;
  phone?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
}

/** Validates exactly the fields this component renders. `requireLabel: false` skips the label check — the checkout derives it from `street` instead of asking for it (C1-checkout-datos.md §3). */
export function validateAddress(
  form: SaveAddressInput,
  options: { requireLabel?: boolean } = {},
): AddressFormErrors {
  const { requireLabel = true } = options;
  const next: AddressFormErrors = {};
  if (requireLabel && !form.label.trim()) next.label = "El nombre de la dirección es obligatorio.";
  if (form.recipientName.trim().length < 3) next.recipientName = "El nombre de quien recibe es demasiado corto.";
  if (!/^\d{10}$/.test(form.phone.trim())) next.phone = "El teléfono debe tener 10 dígitos.";
  if (form.street.trim().length < 3) next.street = "La calle es obligatoria.";
  if (form.neighborhood.trim().length < 2) next.neighborhood = "La colonia es obligatoria.";
  if (form.city.trim().length < 2) next.city = "La ciudad es obligatoria.";
  if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "El código postal debe tener 5 dígitos.";
  return next;
}

export interface AddressFieldsProps {
  form: SaveAddressInput;
  errors: AddressFormErrors;
  onChange: <K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]) => void;
  /** Hidden in the checkout — see `validateAddress`'s `requireLabel`. Defaults to shown, for the account address book (A3). */
  showLabelField?: boolean;
}

/** The field list shared by `AddressForm` (A3's modal) and the checkout's shipping step — presentation and validation only, no `Modal`, no `fetch`. */
export function AddressFields({ form, errors, onChange, showLabelField = true }: AddressFieldsProps) {
  return (
    <div className="flex flex-col gap-md">
      {showLabelField ? (
        <Input
          label="Nombre de la dirección"
          placeholder="Casa, Oficina…"
          value={form.label}
          onChange={(event) => onChange("label", event.target.value)}
          error={errors.label}
        />
      ) : null}
      <Input
        label="Nombre de quien recibe"
        value={form.recipientName}
        onChange={(event) => onChange("recipientName", event.target.value)}
        error={errors.recipientName}
      />
      <Input
        label="Teléfono"
        type="tel"
        value={form.phone}
        onChange={(event) => onChange("phone", event.target.value)}
        error={errors.phone}
        helper="10 dígitos."
      />
      <Input
        label="Calle"
        value={form.street}
        onChange={(event) => onChange("street", event.target.value)}
        error={errors.street}
      />
      <Input
        label="Número interior (opcional)"
        value={form.interiorNumber ?? ""}
        onChange={(event) => onChange("interiorNumber", event.target.value)}
      />
      <Input
        label="Colonia"
        value={form.neighborhood}
        onChange={(event) => onChange("neighborhood", event.target.value)}
        error={errors.neighborhood}
      />
      <div className="grid gap-md sm:grid-cols-2">
        <Input
          label="Ciudad"
          value={form.city}
          onChange={(event) => onChange("city", event.target.value)}
          error={errors.city}
        />
        <Select
          label="Estado"
          value={form.state}
          onChange={(event) => onChange("state", event.target.value as MexicanState)}
        >
          {MEXICAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Código postal"
        value={form.postalCode}
        onChange={(event) => onChange("postalCode", event.target.value)}
        error={errors.postalCode}
        helper="5 dígitos."
      />
      <Input
        label="Referencias (opcional)"
        value={form.references ?? ""}
        onChange={(event) => onChange("references", event.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bw-bikes/web test -- AddressFields.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Refactor `AddressForm.tsx` to compose it**

Replace the full contents of `apps/web/src/components/account/AddressForm.tsx` with:

```tsx
"use client";

import type { SaveAddressInput, SavedAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createAccountAddress, updateAccountAddress } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { AddressFields, validateAddress, type AddressFormErrors } from "./AddressFields";

export interface AddressFormProps {
  /** Present when editing an existing entry; absent when creating a new one. */
  initial?: SavedAddress;
  onClose: () => void;
  onSaved: (addresses: SavedAddress[]) => void;
}

const EMPTY_FORM: SaveAddressInput = {
  label: "",
  recipientName: "",
  phone: "",
  street: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: MEXICAN_STATES[0],
  postalCode: "",
  country: "MX",
  references: "",
};

/** Modal reused for both creating and editing an address book entry. */
export function AddressForm({ initial, onClose, onSaved }: AddressFormProps) {
  const [form, setForm] = useState<SaveAddressInput>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validateAddress(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: SaveAddressInput = {
      ...form,
      label: form.label.trim(),
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      interiorNumber: form.interiorNumber?.trim() || undefined,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      references: form.references?.trim() || undefined,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      const addresses = initial ? await updateAccountAddress(initial.id, payload) : await createAccountAddress(payload);
      onSaved(addresses);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Editar dirección" : "Añadir dirección"}
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
        <AddressFields form={form} errors={errors} onChange={set} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 6: Run `AddressForm`'s existing test to confirm zero regression**

Run: `pnpm --filter @bw-bikes/web test -- AddressForm.test.tsx`
Expected: PASS (all 3 existing tests, unmodified) — confirms the refactor preserved DOM structure and labels exactly.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/account/AddressFields.tsx apps/web/src/components/account/AddressFields.test.tsx apps/web/src/components/account/AddressForm.tsx
git commit -m "refactor(web): extract AddressFields from AddressForm

Pure extraction — AddressForm's DOM and behavior are unchanged (its
own test suite passes untouched). AddressFields is the reusable half
the checkout's shipping step needs, with a showLabelField escape
hatch for the one field checkout derives instead of asking for."
```

---

## Task 5: Extract `BillingFields` from `BillingInfoForm`

**Files:**
- Create: `apps/web/src/components/account/BillingFields.tsx`
- Modify: `apps/web/src/components/account/BillingInfoForm.tsx`
- Verify unchanged: `apps/web/src/components/account/BillingInfoForm.test.tsx`

Same shape as Task 4. No new test file for `BillingFields` itself — `validateBillingInfo` is trivial and gets full coverage indirectly through `BillingCard.test.tsx` in Task 9; writing a third near-duplicate validator-only test file for it would be redundant with Task 4's.

- [ ] **Step 1: Read the existing test to confirm the DOM contract to preserve**

Run: `cat apps/web/src/components/account/BillingInfoForm.test.tsx`

Note the exact label strings it queries by (`"RFC"`, `"Razón social"`, `"Uso de CFDI"`, `"Régimen fiscal"`, `"Código postal fiscal"`) — `BillingFields` must render them identically.

- [ ] **Step 2: Create `BillingFields.tsx`**

```tsx
"use client";

import type { BillingInfo, CfdiUse, TaxRegime } from "@bw-bikes/shared";
import { CFDI_USE_LABELS, CFDI_USES, TAX_REGIME_LABELS, TAX_REGIMES } from "@bw-bikes/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface BillingFormErrors {
  rfc?: string;
  legalName?: string;
  postalCode?: string;
}

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export function validateBillingInfo(form: BillingInfo): BillingFormErrors {
  const next: BillingFormErrors = {};
  if (!RFC_PATTERN.test(form.rfc.trim().toUpperCase())) next.rfc = "El RFC no tiene un formato válido.";
  if (form.legalName.trim().length < 3) next.legalName = "La razón social es demasiado corta.";
  if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "El código postal debe tener 5 dígitos.";
  return next;
}

export interface BillingFieldsProps {
  form: BillingInfo;
  errors: BillingFormErrors;
  onChange: <K extends keyof BillingInfo>(key: K, value: BillingInfo[K]) => void;
}

/** The field list shared by `BillingInfoForm` (A3's modal) and the checkout's billing step. */
export function BillingFields({ form, errors, onChange }: BillingFieldsProps) {
  return (
    <div className="flex flex-col gap-md">
      <Input
        label="RFC"
        value={form.rfc}
        onChange={(event) => onChange("rfc", event.target.value)}
        error={errors.rfc}
      />
      <Input
        label="Razón social"
        value={form.legalName}
        onChange={(event) => onChange("legalName", event.target.value)}
        error={errors.legalName}
      />
      <Select label="Uso de CFDI" value={form.cfdiUse} onChange={(event) => onChange("cfdiUse", event.target.value as CfdiUse)}>
        {CFDI_USES.map((use) => (
          <option key={use} value={use}>
            {CFDI_USE_LABELS[use]}
          </option>
        ))}
      </Select>
      <Select
        label="Régimen fiscal"
        value={form.taxRegime}
        onChange={(event) => onChange("taxRegime", event.target.value as TaxRegime)}
      >
        {TAX_REGIMES.map((regime) => (
          <option key={regime} value={regime}>
            {TAX_REGIME_LABELS[regime]}
          </option>
        ))}
      </Select>
      <Input
        label="Código postal fiscal"
        value={form.postalCode}
        onChange={(event) => onChange("postalCode", event.target.value)}
        error={errors.postalCode}
        helper="5 dígitos."
      />
    </div>
  );
}
```

- [ ] **Step 3: Refactor `BillingInfoForm.tsx` to compose it**

Replace the full contents of `apps/web/src/components/account/BillingInfoForm.tsx` with:

```tsx
"use client";

import type { BillingInfo } from "@bw-bikes/shared";
import { CFDI_USES, TAX_REGIMES } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { setAccountBillingInfo } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { BillingFields, validateBillingInfo, type BillingFormErrors } from "./BillingFields";

export interface BillingInfoFormProps {
  initial?: BillingInfo;
  onClose: () => void;
  onSaved: (billingInfo: BillingInfo) => void;
}

const EMPTY_FORM: BillingInfo = {
  rfc: "",
  legalName: "",
  cfdiUse: CFDI_USES[0],
  taxRegime: TAX_REGIMES[0],
  postalCode: "",
};

export function BillingInfoForm({ initial, onClose, onSaved }: BillingInfoFormProps) {
  const [form, setForm] = useState<BillingInfo>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<BillingFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof BillingInfo>(key: K, value: BillingInfo[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validateBillingInfo(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const billingInfo = await setAccountBillingInfo({
        ...form,
        rfc: form.rfc.trim().toUpperCase(),
        legalName: form.legalName.trim(),
        postalCode: form.postalCode.trim(),
      });
      onSaved(billingInfo);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudieron guardar los datos fiscales.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Datos de facturación"
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
        <BillingFields form={form} errors={errors} onChange={set} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Run `BillingInfoForm`'s existing test to confirm zero regression**

Run: `pnpm --filter @bw-bikes/web test -- BillingInfoForm.test.tsx`
Expected: PASS (all existing tests, unmodified)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/account/BillingFields.tsx apps/web/src/components/account/BillingInfoForm.tsx
git commit -m "refactor(web): extract BillingFields from BillingInfoForm

Same extraction as AddressFields (previous commit) — BillingInfoForm's
DOM and behavior are unchanged; BillingFields is the reusable half the
checkout's billing step needs."
```

---

## Task 6: Checkout route shell — layout, header, redirect

**Files:**
- Create: `apps/web/src/components/checkout/CheckoutHeader.tsx`
- Create: `apps/web/src/app/(checkout)/layout.tsx`
- Create: `apps/web/src/app/(checkout)/checkout/page.tsx`

No test file for this task — it's routing/layout wiring with no logic of its own; it's exercised end-to-end once `envio/page.tsx` exists (Task 11) and by the manual verification pass at the end of this plan. Writing a render test for a layout whose only job is composing already-tested pieces would test React itself, not this code.

- [ ] **Step 1: Create `CheckoutHeader.tsx`**

```tsx
import { Lock } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * The checkout's own reduced chrome — 64px, same height as `Navbar`, but
 * with none of its links, search, cart button, or account menu.
 * `DESIGN_SYSTEM.md:325,350`: checkout is the one screen in the site with
 * zero rinoceronte appearances and no footer — a conversion screen, not a
 * browsing one.
 */
export function CheckoutHeader() {
  return (
    <div className="flex h-16 items-center justify-between border-b border-borde bg-surface px-lg">
      <ButtonLink href="/carrito" variant="text" size="sm">
        ← Volver al carrito
      </ButtonLink>
      <p className="font-display text-h3 text-negro">Black and White Bikes</p>
      <div className="flex items-center gap-xs font-body text-caption text-grafito">
        <Lock size={14} weight="regular" aria-hidden="true" />
        Pago seguro
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the route group layout**

Create `apps/web/src/app/(checkout)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { CartProvider } from "@/components/cart/CartProvider";
import { SkipLink } from "@/components/shell/SkipLink";
import { ToastProvider } from "@/components/ui/Toast";
import { requireCustomerSession } from "@/lib/auth/session";

/**
 * The checkout's own route group — sibling to `(storefront)`, not nested
 * inside it. `DESIGN_SYSTEM.md:325,350` requires zero rinoceronte
 * appearances, no footer, and a reduced nav on every checkout screen; the
 * only way to guarantee that is a chrome this tree owns outright, rather
 * than hiding `(storefront)`'s `Footer`/`Navbar` per-route.
 *
 * No `CartDrawer` here either — opening a cart drawer over a payment form
 * would be a UX error, and `CheckoutHeader`'s "Volver al carrito" already
 * covers "I want to go edit my cart".
 *
 * The session guard lives once, here, for the whole route group — same
 * pattern as `mi-cuenta/layout.tsx` — so no page under `/checkout` repeats it.
 */
export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  await requireCustomerSession("/checkout/envio");

  return (
    <ToastProvider>
      <CartProvider>
        <SkipLink targetId="contenido" />
        <CheckoutHeader />
        <main id="contenido" tabIndex={-1} className="bg-base focus:outline-none">
          {children}
        </main>
      </CartProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Create the `/checkout` redirect**

Create `apps/web/src/app/(checkout)/checkout/page.tsx`:

```tsx
import { redirect } from "next/navigation";

/** `/checkout` bare is a URL people type or bookmark — it always means "start the flow". */
export default function CheckoutIndexPage() {
  redirect("/checkout/envio");
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bw-bikes/web typecheck`
Expected: PASS — no TypeScript errors. (`envio/page.tsx` doesn't exist yet, so `/checkout/envio` isn't a resolvable route yet at the type level for `redirect()`'s literal-path checking if that's enabled; if typecheck fails specifically on that string, proceed to Task 11 first and revisit — otherwise this is expected to pass since `redirect()` takes a plain string, not a typed route, in this codebase's Next.js config.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/checkout/CheckoutHeader.tsx "apps/web/src/app/(checkout)/layout.tsx" "apps/web/src/app/(checkout)/checkout/page.tsx"
git commit -m "feat(web): add checkout route group shell

Reduced chrome (no navbar/footer/rhino) per DESIGN_SYSTEM.md's
explicit checkout rule, and the session guard for the whole route
group in one place."
```

---

## Task 7: `CheckoutGuard` + `CheckoutSkeleton`

**Files:**
- Create: `apps/web/src/components/checkout/CheckoutSkeleton.tsx`
- Create: `apps/web/src/components/checkout/CheckoutGuard.tsx`
- Test: `apps/web/src/components/checkout/CheckoutGuard.test.tsx`

`CheckoutGuard` is the switch over `useCart().status` from C1 §2 — same shape as `CartPageClient`, plus the `hasBlockingLines` case, which renders the form disabled behind a banner instead of replacing it.

- [ ] **Step 1: Create `CheckoutSkeleton.tsx`**

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state for the whole `/checkout/envio` grid — same two-column shape as the loaded page, so nothing shifts once data lands. */
export function CheckoutSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[1fr_21rem]">
      <div className="flex flex-col gap-md">
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/components/checkout/CheckoutGuard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { CheckoutGuard } = await import("./CheckoutGuard");

const PURCHASABLE_CART = {
  id: "cart-1",
  lines: [{ itemType: "bike", sku: "BK-1", isPurchasable: true }],
  hasBlockingLines: false,
  subtotalCents: 100,
  totalCents: 100,
};

describe("CheckoutGuard", () => {
  it("shows the skeleton while loading, without navigating", () => {
    useCartMock.mockReturnValue({ cart: null, status: "loading" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.queryByText("steps")).not.toBeInTheDocument();
  });

  it("shows CartUnauthenticated when anonymous, without navigating", () => {
    useCartMock.mockReturnValue({ cart: null, status: "anonymous" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.getByText("Inicia sesión para ver tu carrito")).toBeInTheDocument();
  });

  it("shows an empty-cart message when the cart has no lines", () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, lines: [] }, status: "ready" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.queryByText("steps")).not.toBeInTheDocument();
  });

  it("renders steps and summary for a purchasable cart", () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART, status: "ready" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByText("summary")).toBeInTheDocument();
  });

  it("shows a blocking-lines banner and disables the steps fieldset, without hiding the form", () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, hasBlockingLines: true }, status: "ready" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByText(/Ajusta los productos marcados/)).toBeInTheDocument();
    expect(screen.getByRole("group")).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @bw-bikes/web test -- CheckoutGuard.test.tsx`
Expected: FAIL — `./CheckoutGuard` doesn't exist.

- [ ] **Step 4: Implement `CheckoutGuard.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { useCart } from "@/components/cart/CartProvider";
import { CartUnauthenticated } from "@/components/cart/CartUnauthenticated";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckoutSkeleton } from "./CheckoutSkeleton";

export interface CheckoutGuardProps {
  /** The two accordion cards (shipping + billing) — disabled as a group when `hasBlockingLines`, never hidden. */
  steps: ReactNode;
  /** The sticky summary column — stays interactive even when `steps` is disabled, so "Volver al carrito" and the coupon form remain reachable. */
  summary: ReactNode;
}

/**
 * The switch over `useCart().status` from C1-checkout-datos.md §2 — same
 * shape as `CartPageClient`, plus one case it doesn't have: a cart with
 * `hasBlockingLines` renders the form disabled behind a banner instead of
 * replacing it. None of these cases navigate on their own; only the visitor
 * decides to leave.
 */
export function CheckoutGuard({ steps, summary }: CheckoutGuardProps) {
  const { cart, status } = useCart();

  if (status === "idle" || status === "loading") {
    return <CheckoutSkeleton />;
  }

  if (status === "anonymous") {
    return <CartUnauthenticated />;
  }

  if (status === "error" || !cart) {
    return (
      <div className="flex flex-col items-center gap-md rounded-card border border-borde bg-surface p-xl text-center">
        <WarningCircle size={32} weight="regular" aria-hidden="true" className="text-estado-error" />
        <p className="font-ui text-ui text-negro">No pudimos cargar tu carrito.</p>
        <Button variant="secondary" size="md" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega algo al carrito antes de pasar al checkout."
        action={
          <ButtonLink href="/catalogo" variant="primary" size="md">
            Ver catálogo
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[1fr_21rem] lg:items-start">
      <div className="flex flex-col gap-md">
        {cart.hasBlockingLines ? (
          <p className="flex items-center gap-xs rounded-control bg-estado-error-soft px-md py-sm font-body text-caption text-estado-error">
            <WarningCircle size={16} weight="regular" aria-hidden="true" className="shrink-0" />
            Ajusta los productos marcados para poder continuar.{" "}
            <ButtonLink href="/carrito" variant="text" size="sm">
              Volver al carrito
            </ButtonLink>
          </p>
        ) : null}
        <fieldset disabled={cart.hasBlockingLines} className="contents border-0 p-0 m-0">
          {steps}
        </fieldset>
      </div>
      <div className="lg:sticky lg:top-[88px]">{summary}</div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @bw-bikes/web test -- CheckoutGuard.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/checkout/CheckoutSkeleton.tsx apps/web/src/components/checkout/CheckoutGuard.tsx apps/web/src/components/checkout/CheckoutGuard.test.tsx
git commit -m "feat(web): add CheckoutGuard — cart-state switch for /checkout

Mirrors CartPageClient's states, plus hasBlockingLines: renders the
form disabled behind a banner rather than hiding it, never redirects
on its own (C1-checkout-datos.md §2)."
```

---

## Task 8: `ShippingAddressCard`

**Files:**
- Create: `apps/web/src/components/checkout/ShippingAddressCard.tsx`
- Test: `apps/web/src/components/checkout/ShippingAddressCard.test.tsx`

This is the most involved component in C1. It composes `AddressFields`/`validateAddress` (Task 4) and `useCart().setShippingAddress` (Task 3) and orchestrates the account-address-book calls (`createAccountAddress`, `setDefaultAccountAddress`, both already existing in `@/lib/api/account`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/checkout/ShippingAddressCard.test.tsx`:

```tsx
import type { SavedAddress } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAccountAddressMock, setDefaultAccountAddressMock, setShippingAddressMock, useCartMock } = vi.hoisted(() => ({
  createAccountAddressMock: vi.fn(),
  setDefaultAccountAddressMock: vi.fn(),
  setShippingAddressMock: vi.fn(),
  useCartMock: vi.fn(),
}));

vi.mock("@/lib/api/account", () => ({
  createAccountAddress: createAccountAddressMock,
  setDefaultAccountAddress: setDefaultAccountAddressMock,
}));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { ShippingAddressCard } = await import("./ShippingAddressCard");

const DEFAULT_ADDRESS: SavedAddress = {
  id: "addr-default",
  label: "Casa",
  isDefault: true,
  recipientName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

const SECOND_ADDRESS: SavedAddress = { ...DEFAULT_ADDRESS, id: "addr-second", isDefault: false, label: "Oficina" };

const PROFILE = { firstName: "Ana", lastName: "Pérez", phone: "5512345678" };

function setup(cart: { shippingAddress?: unknown } | null = null) {
  useCartMock.mockReturnValue({
    cart,
    setShippingAddress: setShippingAddressMock,
  });
}

describe("ShippingAddressCard", () => {
  beforeEach(() => {
    createAccountAddressMock.mockReset();
    setDefaultAccountAddressMock.mockReset();
    setShippingAddressMock.mockReset().mockResolvedValue(undefined);
  });

  it("shows the address form directly when the book is empty", () => {
    setup();
    render(<ShippingAddressCard addresses={[]} onAddressesChange={vi.fn()} profile={PROFILE} />);
    expect(screen.getByLabelText("Nombre de quien recibe")).toHaveValue("Ana Pérez");
    expect(screen.queryByLabelText("Nombre de la dirección")).not.toBeInTheDocument();
  });

  it("pre-selects the default address when the book has entries", () => {
    setup();
    render(
      <ShippingAddressCard addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />,
    );
    expect(screen.getByRole("radio", { name: /Av. Reforma 123/ })).toBeChecked();
  });

  it("confirming the pre-selected default only PUTs the cart — no promote-to-default call", async () => {
    setup();
    const user = userEvent.setup();
    render(
      <ShippingAddressCard addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />,
    );

    await user.click(screen.getByRole("button", { name: "Usar esta dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(setDefaultAccountAddressMock).not.toHaveBeenCalled();
    expect(setShippingAddressMock).toHaveBeenCalledWith(expect.objectContaining({ street: "Av. Reforma 123" }));
  });

  it("choosing a non-default address promotes it to default, then PUTs the cart", async () => {
    setup();
    setDefaultAccountAddressMock.mockResolvedValue([
      { ...DEFAULT_ADDRESS, isDefault: false },
      { ...SECOND_ADDRESS, isDefault: true },
    ]);
    const onAddressesChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ShippingAddressCard
        addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]}
        onAddressesChange={onAddressesChange}
        profile={PROFILE}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Oficina/ }));
    await user.click(screen.getByRole("button", { name: "Usar esta dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(setDefaultAccountAddressMock).toHaveBeenCalledWith("addr-second");
    expect(onAddressesChange).toHaveBeenCalled();
  });

  it("adding a new address creates it, promotes it if needed, then PUTs the cart, in that order", async () => {
    setup();
    createAccountAddressMock.mockResolvedValue([DEFAULT_ADDRESS, { ...SECOND_ADDRESS, id: "addr-new", isDefault: false }]);
    setDefaultAccountAddressMock.mockResolvedValue([
      { ...DEFAULT_ADDRESS, isDefault: false },
      { ...SECOND_ADDRESS, id: "addr-new", isDefault: true },
    ]);
    const onAddressesChange = vi.fn();
    const user = userEvent.setup();
    render(<ShippingAddressCard addresses={[DEFAULT_ADDRESS]} onAddressesChange={onAddressesChange} profile={PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
    await user.type(screen.getByLabelText("Nombre de quien recibe"), "Otro Nombre");
    await user.type(screen.getByLabelText("Teléfono"), "5500000000");
    await user.type(screen.getByLabelText("Calle"), "Otra calle 45");
    await user.type(screen.getByLabelText("Colonia"), "Otra colonia");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "01000");
    await user.click(screen.getByRole("button", { name: "Guardar dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());

    const createOrder = createAccountAddressMock.mock.invocationCallOrder[0]!;
    const defaultOrder = setDefaultAccountAddressMock.mock.invocationCallOrder[0]!;
    const putOrder = setShippingAddressMock.mock.invocationCallOrder[0]!;
    expect(createOrder).toBeLessThan(defaultOrder);
    expect(defaultOrder).toBeLessThan(putOrder);

    expect(createAccountAddressMock).toHaveBeenCalledWith(expect.objectContaining({ label: "Otra calle 45" }));
  });

  it("still PUTs the cart when the address book is full (409), with a discreet notice", async () => {
    setup();
    const { ApiError } = await import("@/lib/api/error");
    createAccountAddressMock.mockRejectedValue(new ApiError("No puedes guardar más de 5 direcciones.", 409));
    const user = userEvent.setup();
    render(<ShippingAddressCard addresses={[DEFAULT_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
    await user.type(screen.getByLabelText("Nombre de quien recibe"), "Otro Nombre");
    await user.type(screen.getByLabelText("Teléfono"), "5500000000");
    await user.type(screen.getByLabelText("Calle"), "Otra calle 45");
    await user.type(screen.getByLabelText("Colonia"), "Otra colonia");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "01000");
    await user.click(screen.getByRole("button", { name: "Guardar dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(screen.getByText(/libreta está llena/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bw-bikes/web test -- ShippingAddressCard.test.tsx`
Expected: FAIL — `./ShippingAddressCard` doesn't exist.

- [ ] **Step 3: Implement `ShippingAddressCard.tsx`**

```tsx
"use client";

import type { SaveAddressInput, SavedAddress, ShippingAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { createAccountAddress, setDefaultAccountAddress } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { AddressFields, validateAddress, type AddressFormErrors } from "@/components/account/AddressFields";

/**
 * Mirrors `MAX_LABEL_LENGTH` (`apps/api/src/models/schemas/saved-address.schema.ts`).
 * Re-declared here, not imported — `apps/web` never imports `apps/api` source
 * (same convention as `BULK_ALLOWED_STATUSES` in `lib/orders/status.ts`).
 */
const MAX_LABEL_LENGTH = 30;

export interface ShippingAddressCardProps {
  addresses: SavedAddress[];
  onAddressesChange: (addresses: SavedAddress[]) => void;
  profile: { firstName: string; lastName: string; phone?: string };
}

type Mode = "summary" | "choose" | "create";

const EMPTY_FORM: SaveAddressInput = {
  label: "",
  recipientName: "",
  phone: "",
  street: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: MEXICAN_STATES[0],
  postalCode: "",
  country: "MX",
  references: "",
};

function toShippingAddress(input: SavedAddress | SaveAddressInput): ShippingAddress {
  return {
    recipientName: input.recipientName,
    phone: input.phone,
    street: input.street,
    interiorNumber: input.interiorNumber,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country,
    references: input.references,
  };
}

/**
 * The Envío card of the checkout accordion (C1-checkout-datos.md §3, layout
 * A). Three modes: `"summary"` (already confirmed this session — collapsed,
 * "Editar" to reopen), `"choose"` (radio list of the address book,
 * pre-selected to the default), `"create"` (the account's own `AddressFields`
 * with the "Nombre de la dirección" field hidden — the label is derived from
 * `street`, never typed here).
 *
 * Confirming, whichever mode got there, runs the same three-step sequence:
 * create the address if it's new, promote it to default if it isn't already,
 * then `PUT /cart/shipping-address` — exactly the order the spec fixes,
 * because the *next* visit should autofill with whichever address the
 * customer actually paid with.
 */
export function ShippingAddressCard({ addresses, onAddressesChange, profile }: ShippingAddressCardProps) {
  const { cart, setShippingAddress } = useCart();
  const confirmedAddress = (cart as { shippingAddress?: ShippingAddress } | null)?.shippingAddress;
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  const [mode, setMode] = useState<Mode>(() => {
    if (confirmedAddress) return "summary";
    if (addresses.length === 0) return "create";
    return "choose";
  });
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultAddress?.id);
  const [form, setForm] = useState<SaveAddressInput>({
    ...EMPTY_FORM,
    recipientName: `${profile.firstName} ${profile.lastName}`.trim(),
    phone: profile.phone ?? "",
  });
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookFullNotice, setBookFullNotice] = useState(false);

  function set<K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function confirmExisting(addressId: string): Promise<void> {
    const address = addresses.find((entry) => entry.id === addressId);
    if (!address) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      let nextAddresses = addresses;
      if (!address.isDefault) {
        nextAddresses = await setDefaultAccountAddress(addressId);
        onAddressesChange(nextAddresses);
      }
      await setShippingAddress(toShippingAddress(address));
      setBookFullNotice(false);
      setMode("summary");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmNew(): Promise<void> {
    const nextErrors = validateAddress(form, { requireLabel: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: SaveAddressInput = {
      ...form,
      label: form.street.trim().slice(0, MAX_LABEL_LENGTH),
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      interiorNumber: form.interiorNumber?.trim() || undefined,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      references: form.references?.trim() || undefined,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      let usedAddress: SaveAddressInput | SavedAddress = payload;
      let bookFull = false;

      try {
        const created = await createAccountAddress(payload);
        onAddressesChange(created);
        const newest = created[created.length - 1]!;
        usedAddress = newest;
        if (!newest.isDefault) {
          const promoted = await setDefaultAccountAddress(newest.id);
          onAddressesChange(promoted);
        }
      } catch (err) {
        if (err instanceof ApiError && err.httpStatus === 409) {
          bookFull = true;
        } else {
          throw err;
        }
      }

      await setShippingAddress(toShippingAddress(usedAddress));
      setBookFullNotice(bookFull);
      setMode("summary");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "summary") {
    const shown = confirmedAddress ?? (selectedId ? addresses.find((address) => address.id === selectedId) : undefined);
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <div className="flex items-start justify-between gap-sm">
          <h2 className="font-display text-h4 text-negro">Envío</h2>
          <Button variant="text" size="sm" onClick={() => setMode("choose")}>
            Editar
          </Button>
        </div>
        {shown ? (
          <div>
            <p className="font-ui text-ui text-negro">{shown.street}</p>
            <p className="font-body text-caption text-grafito">
              {shown.recipientName} · {shown.neighborhood}, {shown.city}, {shown.state} · {shown.postalCode}
            </p>
          </div>
        ) : null}
        {bookFullNotice ? (
          <p className="font-body text-caption text-estado-advertencia">
            Tu libreta está llena, así que esta dirección se usa solo para este pedido.
          </p>
        ) : null}
      </section>
    );
  }

  if (mode === "create") {
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <h2 className="font-display text-h4 text-negro">Envío</h2>
        <AddressFields form={form} errors={errors} onChange={set} showLabelField={false} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
        <div className="flex items-center gap-md">
          <Button variant="primary" size="md" loading={submitting} onClick={() => void confirmNew()}>
            Guardar dirección
          </Button>
          {addresses.length > 0 ? (
            <Button variant="text" size="sm" onClick={() => setMode("choose")}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
      <h2 className="font-display text-h4 text-negro">Envío</h2>
      <div role="radiogroup" aria-label="Dirección de envío" className="flex flex-col gap-sm">
        {addresses.map((address) => (
          <label
            key={address.id}
            className="flex items-start gap-sm rounded-control border border-borde p-md has-checked:border-negro has-checked:bg-inset"
          >
            <input
              type="radio"
              name="shipping-address"
              value={address.id}
              checked={selectedId === address.id}
              onChange={() => setSelectedId(address.id)}
              className="mt-xs"
            />
            <span>
              <span className="block font-ui text-ui text-negro">{address.street}</span>
              <span className="block font-body text-caption text-grafito">
                {address.recipientName} · {address.neighborhood}, {address.city}, {address.state} · {address.postalCode}
              </span>
            </span>
          </label>
        ))}
      </div>
      {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      <div className="flex items-center gap-md">
        <Button
          variant="primary"
          size="md"
          loading={submitting}
          disabled={!selectedId}
          onClick={() => selectedId && void confirmExisting(selectedId)}
        >
          Usar esta dirección
        </Button>
        <Button variant="text" size="sm" onClick={() => setMode("create")}>
          Agregar dirección
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bw-bikes/web test -- ShippingAddressCard.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @bw-bikes/web typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/checkout/ShippingAddressCard.tsx apps/web/src/components/checkout/ShippingAddressCard.test.tsx
git commit -m "feat(web): add ShippingAddressCard for /checkout/envio

Three modes (summary/choose/create) over the account address book,
confirming always runs create-if-new -> promote-if-not-default ->
PUT /cart/shipping-address, so the next visit autofills with whatever
address the customer actually used (C1-checkout-datos.md §3)."
```

---

## Task 9: `BillingCard`

**Files:**
- Create: `apps/web/src/components/checkout/BillingCard.tsx`
- Test: `apps/web/src/components/checkout/BillingCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/checkout/BillingCard.test.tsx`:

```tsx
import type { BillingInfo } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setBillingInfoMock, removeBillingInfoMock, useCartMock } = vi.hoisted(() => ({
  setBillingInfoMock: vi.fn(),
  removeBillingInfoMock: vi.fn(),
  useCartMock: vi.fn(),
}));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { BillingCard } = await import("./BillingCard");

const SAVED_BILLING: BillingInfo = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};

describe("BillingCard", () => {
  beforeEach(() => {
    setBillingInfoMock.mockReset().mockResolvedValue(undefined);
    removeBillingInfoMock.mockReset().mockResolvedValue(undefined);
  });

  it("starts unchecked and collapsed when the cart has no billing info", () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: undefined },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    render(<BillingCard initialBillingInfo={undefined} />);
    expect(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" })).not.toBeChecked();
    expect(screen.queryByLabelText("RFC")).not.toBeInTheDocument();
  });

  it("checking the box reveals the fields, pre-filled from the account's saved billing info", async () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: undefined },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={SAVED_BILLING} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));

    expect(screen.getByLabelText("RFC")).toHaveValue("XAXX010101000");
  });

  it("saving valid CFDI data calls setBillingInfo and collapses the card", async () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: undefined },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={undefined} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));
    await user.type(screen.getByLabelText("RFC"), "XAXX010101000");
    await user.type(screen.getByLabelText("Razón social"), "Ana Pérez");
    await user.type(screen.getByLabelText("Código postal fiscal"), "06600");
    await user.click(screen.getByRole("button", { name: "Guardar datos fiscales" }));

    await waitFor(() => expect(setBillingInfoMock).toHaveBeenCalled());
    expect(setBillingInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({ rfc: "XAXX010101000", legalName: "Ana Pérez", postalCode: "06600" }),
    );
  });

  it("unchecking after it was saved calls removeBillingInfo", async () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: SAVED_BILLING },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={SAVED_BILLING} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));

    await waitFor(() => expect(removeBillingInfoMock).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bw-bikes/web test -- BillingCard.test.tsx`
Expected: FAIL — `./BillingCard` doesn't exist.

- [ ] **Step 3: Implement `BillingCard.tsx`**

```tsx
"use client";

import type { BillingInfo } from "@bw-bikes/shared";
import { CFDI_USES, TAX_REGIMES } from "@bw-bikes/shared";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { BillingFields, validateBillingInfo, type BillingFormErrors } from "@/components/account/BillingFields";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ApiError } from "@/lib/api/error";

export interface BillingCardProps {
  /** The account's own saved CFDI data (A3), used only to pre-fill the form the first time the checkbox is checked. */
  initialBillingInfo?: BillingInfo;
}

const emptyForm = (prefill?: BillingInfo): BillingInfo =>
  prefill ?? { rfc: "", legalName: "", cfdiUse: CFDI_USES[0], taxRegime: TAX_REGIMES[0], postalCode: "" };

/**
 * The Facturación card (C1-checkout-datos.md §4) — a single checkbox that
 * gates the CFDI fields. Nothing here touches the account's own billing
 * info; every write is `PUT`/`DELETE /cart/billing-info` via `useCart()`,
 * scoped to this cart the same way the shipping address is.
 */
export function BillingCard({ initialBillingInfo }: BillingCardProps) {
  const { cart, setBillingInfo, removeBillingInfo } = useCart();
  const savedOnCart = (cart as { billingInfo?: BillingInfo } | null)?.billingInfo;

  const [checked, setChecked] = useState(Boolean(savedOnCart));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BillingInfo>(emptyForm(savedOnCart ?? initialBillingInfo));
  const [errors, setErrors] = useState<BillingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof BillingInfo>(key: K, value: BillingInfo[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleToggle(next: boolean): Promise<void> {
    setChecked(next);
    setSubmitError(null);

    if (next) {
      setForm(emptyForm(savedOnCart ?? initialBillingInfo));
      setEditing(!savedOnCart);
      return;
    }

    setEditing(false);
    if (savedOnCart) {
      try {
        await removeBillingInfo();
      } catch (err) {
        setSubmitError(err instanceof ApiError ? err.message : "No se pudieron eliminar los datos fiscales.");
      }
    }
  }

  async function handleSave(): Promise<void> {
    const nextErrors = validateBillingInfo(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await setBillingInfo({
        ...form,
        rfc: form.rfc.trim().toUpperCase(),
        legalName: form.legalName.trim(),
        postalCode: form.postalCode.trim(),
      });
      setEditing(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudieron guardar los datos fiscales.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
      <h2 className="font-display text-h4 text-negro">Facturación</h2>
      <Checkbox
        label="Necesito factura (CFDI)"
        checked={checked}
        onChange={(event) => void handleToggle(event.target.checked)}
      />

      {checked && editing ? (
        <>
          <BillingFields form={form} errors={errors} onChange={set} />
          {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
          <Button variant="primary" size="md" loading={submitting} onClick={() => void handleSave()}>
            Guardar datos fiscales
          </Button>
        </>
      ) : null}

      {checked && !editing && savedOnCart ? (
        <div className="flex items-start justify-between gap-sm">
          <div>
            <p className="font-ui text-ui text-negro">{savedOnCart.legalName}</p>
            <p className="font-body text-caption text-grafito">RFC {savedOnCart.rfc}</p>
          </div>
          <Button variant="text" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bw-bikes/web test -- BillingCard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/checkout/BillingCard.tsx apps/web/src/components/checkout/BillingCard.test.tsx
git commit -m "feat(web): add BillingCard for /checkout/envio

Checkbox-gated CFDI fields writing straight to the cart via
setBillingInfo/removeBillingInfo — never touches the account's own
saved billing info, only pre-fills from it (C1-checkout-datos.md §4)."
```

---

## Task 10: `CheckoutSummary`

**Files:**
- Create: `apps/web/src/components/checkout/CheckoutSummary.tsx`
- Test: `apps/web/src/components/checkout/CheckoutSummary.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/checkout/CheckoutSummary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));
vi.mock("@/components/cart/CouponForm", () => ({ CouponForm: () => <div>coupon-form</div> }));

const { CheckoutSummary } = await import("./CheckoutSummary");

const BASE_CART = {
  id: "cart-1",
  lines: [
    {
      itemType: "bike",
      sku: "BK-1",
      name: "Rhino Race",
      brand: "Rhino",
      qty: 1,
      lineTotalCents: 2_500_000,
      isPurchasable: true,
    },
  ],
  subtotalCents: 2_500_000,
  discountCents: 0,
  taxCents: 344_828,
  shippingCents: 0,
  totalCents: 2_500_000,
  captureMethod: "automatic",
  hasBlockingLines: false,
};

describe("CheckoutSummary", () => {
  it("renders the totals without any stock figure in the DOM", () => {
    useCartMock.mockReturnValue({ cart: BASE_CART });
    render(<CheckoutSummary />);
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.queryByText(/available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/onHand/i)).not.toBeInTheDocument();
  });

  it("shows the manual-capture notice when captureMethod is not automatic", () => {
    useCartMock.mockReturnValue({ cart: { ...BASE_CART, captureMethod: "manual" } });
    render(<CheckoutSummary />);
    expect(screen.getByText(/se autoriza ahora/)).toBeInTheDocument();
  });

  it("hides the manual-capture notice when captureMethod is automatic", () => {
    useCartMock.mockReturnValue({ cart: BASE_CART });
    render(<CheckoutSummary />);
    expect(screen.queryByText(/se autoriza ahora/)).not.toBeInTheDocument();
  });

  it("the continue-to-payment link is disabled without a shipping address", () => {
    useCartMock.mockReturnValue({ cart: { ...BASE_CART, shippingAddress: undefined } });
    render(<CheckoutSummary />);
    expect(screen.getByText("Continuar al pago").closest("a")).toHaveAttribute("aria-disabled", "true");
  });

  it("the continue-to-payment link is enabled with a shipping address and no blocking lines", () => {
    useCartMock.mockReturnValue({
      cart: { ...BASE_CART, shippingAddress: { recipientName: "Ana" } },
    });
    render(<CheckoutSummary />);
    const link = screen.getByText("Continuar al pago").closest("a");
    expect(link).toHaveAttribute("href", "/checkout/pago");
    expect(link).not.toHaveAttribute("aria-disabled");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bw-bikes/web test -- CheckoutSummary.test.tsx`
Expected: FAIL — `./CheckoutSummary` doesn't exist.

- [ ] **Step 3: Implement `CheckoutSummary.tsx`**

```tsx
"use client";

import { useCart } from "@/components/cart/CartProvider";
import { CouponForm } from "@/components/cart/CouponForm";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { formatCurrencyCents } from "@/lib/format";

/**
 * The resumen of C1-checkout-datos.md §6 — same totals escalator as
 * `CartSummary`, plus the read-only line list, the coupon form (reused
 * as-is), and the real "Continuar al pago" CTA, gated on a shipping
 * address already being on the cart (`CheckoutGuard` already blocks
 * rendering entirely for an empty/anonymous/errored cart, so this only
 * has to worry about "no address yet").
 */
export function CheckoutSummary() {
  const { cart } = useCart();
  if (!cart) return null;

  const canContinue = Boolean(cart.shippingAddress) && !cart.hasBlockingLines;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
        <h2 className="font-display text-h4 text-negro">Resumen</h2>

        <ul className="flex flex-col gap-sm">
          {cart.lines.map((line) => (
            <li key={`${line.itemType}:${line.sku}`} className="flex items-center justify-between gap-sm">
              <div className="min-w-0">
                <p className="font-body text-eyebrow uppercase text-grafito">{line.brand}</p>
                <p className="truncate font-ui text-ui text-negro">
                  {line.name} · {line.qty}
                </p>
              </div>
              <p className="shrink-0 font-body text-body text-negro">{formatCurrencyCents(line.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-xs font-body text-body text-negro">
          <div className="flex items-center justify-between">
            <dt className="text-grafito">Subtotal</dt>
            <dd>{formatCurrencyCents(cart.subtotalCents)}</dd>
          </div>
          {cart.discountCents > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-grafito">Descuento</dt>
              <dd>−{formatCurrencyCents(cart.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-grafito">IVA</dt>
            <dd>{formatCurrencyCents(cart.taxCents)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-grafito">Envío</dt>
            <dd>{cart.shippingCents === 0 ? "Gratis" : formatCurrencyCents(cart.shippingCents)}</dd>
          </div>
          <div className="mt-xs flex items-center justify-between border-t border-borde pt-xs font-ui text-ui text-negro">
            <dt>Total</dt>
            <dd>{formatCurrencyCents(cart.totalCents)}</dd>
          </div>
        </dl>

        {cart.captureMethod !== "automatic" ? (
          <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-caption text-estado-advertencia">
            Uno o más productos se confirman con el proveedor antes de cobrarse: el cargo se autoriza ahora y se
            confirma después, cuando el proveedor confirme el stock.
          </p>
        ) : null}

        <ButtonLink
          href="/checkout/pago"
          variant="primary"
          size="md"
          className="w-full"
          aria-disabled={canContinue ? undefined : "true"}
          onClick={(event) => {
            if (!canContinue) event.preventDefault();
          }}
          title={canContinue ? undefined : "Captura tu dirección de envío para continuar."}
        >
          Continuar al pago
        </ButtonLink>
      </div>

      <CouponForm coupon={cart.coupon} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bw-bikes/web test -- CheckoutSummary.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/checkout/CheckoutSummary.tsx apps/web/src/components/checkout/CheckoutSummary.test.tsx
git commit -m "feat(web): add CheckoutSummary for /checkout/envio

Same totals escalator as CartSummary plus the real 'Continuar al
pago' CTA, gated on a shipping address already saved to the cart."
```

---

## Task 11: Wire it together — `ShippingStepView` + `envio/page.tsx`

**Files:**
- Create: `apps/web/src/app/(checkout)/checkout/envio/ShippingStepView.tsx`
- Create: `apps/web/src/app/(checkout)/checkout/envio/page.tsx`

No new automated test here — this file composes four already-tested components with no branching logic of its own. It's covered by the manual verification pass (Task 13) and, indirectly, by every child component's own tests.

- [ ] **Step 1: Create `ShippingStepView.tsx`**

```tsx
"use client";

import type { AccountDTO, SavedAddress } from "@bw-bikes/shared";
import { useState } from "react";
import { BillingCard } from "@/components/checkout/BillingCard";
import { CheckoutGuard } from "@/components/checkout/CheckoutGuard";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { ShippingAddressCard } from "@/components/checkout/ShippingAddressCard";

export interface ShippingStepViewProps {
  account: AccountDTO;
}

/**
 * Composes the three accordion cards (Envío, Facturación, and the still-
 * disabled Pago placeholder — C1-checkout-datos.md §0) with the sticky
 * summary. `addresses` lives here, not inside `ShippingAddressCard`, so a
 * newly created or promoted address is visible immediately if the customer
 * reopens the card without a page reload.
 */
export function ShippingStepView({ account }: ShippingStepViewProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(account.addresses);

  return (
    <div className="mx-auto max-w-[68rem] px-lg py-xl pb-3xl">
      <CheckoutGuard
        steps={
          <>
            <ShippingAddressCard
              addresses={addresses}
              onAddressesChange={setAddresses}
              profile={{ firstName: account.firstName, lastName: account.lastName, phone: account.phone }}
            />
            <BillingCard initialBillingInfo={account.billingInfo} />
            <section className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-xl opacity-45">
              <h2 className="font-display text-h4 text-negro">Pago</h2>
              <p className="font-body text-caption text-grafito">Se habilita al continuar.</p>
            </section>
          </>
        }
        summary={<CheckoutSummary />}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `envio/page.tsx`**

```tsx
import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/api/server";
import { ShippingStepView } from "./ShippingStepView";

export const metadata: Metadata = {
  title: "Envío",
  robots: { index: false, follow: false },
};

/**
 * The session guard already ran in `(checkout)/layout.tsx` — this only
 * fetches the account once, server-side, so `ShippingStepView` can prefill
 * without its own client round-trip (same reasoning `mi-cuenta`'s pages use).
 */
export default async function CheckoutShippingPage() {
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");
  return <ShippingStepView account={data.account} />;
}
```

- [ ] **Step 3: Run the full web test suite**

Run: `pnpm --filter @bw-bikes/web test`
Expected: PASS — every suite, including all the ones touched or added in Tasks 2–10.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @bw-bikes/web typecheck && pnpm --filter @bw-bikes/web lint`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(checkout)/checkout/envio/ShippingStepView.tsx" "apps/web/src/app/(checkout)/checkout/envio/page.tsx"
git commit -m "feat(web): wire up /checkout/envio

Composes ShippingAddressCard, BillingCard, and CheckoutSummary behind
CheckoutGuard — the full C1 flow is now reachable end to end."
```

---

## Task 12: Point the cart's CTA at the real checkout

**Files:**
- Modify: `apps/web/src/components/cart/CartSummary.tsx`
- Modify: `apps/web/src/components/cart/CartDrawer.tsx`
- Test: `apps/web/src/components/cart/CartSummary.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/cart/CartSummary.test.tsx`:

```tsx
import type { PublicCart } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartSummary } from "./CartSummary";

const BASE_CART: PublicCart = {
  id: "cart-1",
  lines: [],
  subtotalCents: 2_500_000,
  discountCents: 0,
  taxCents: 344_828,
  shippingCents: 0,
  totalCents: 2_500_000,
  currency: "MXN",
  captureMethod: "automatic",
  hasBlockingLines: false,
  updatedAt: new Date().toISOString(),
};

describe("CartSummary", () => {
  it("links to /checkout/envio instead of a disabled button", () => {
    render(<CartSummary cart={BASE_CART} />);
    const link = screen.getByText("Ir a pagar").closest("a");
    expect(link).toHaveAttribute("href", "/checkout/envio");
  });

  it("no longer shows the 'Disponible próximamente' placeholder", () => {
    render(<CartSummary cart={BASE_CART} />);
    expect(screen.queryByTitle("Disponible próximamente")).not.toBeInTheDocument();
  });

  it("disables the CTA with an explanatory title when the cart has blocking lines", () => {
    render(<CartSummary cart={{ ...BASE_CART, hasBlockingLines: true }} />);
    expect(screen.getByRole("button", { name: "Pagar" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bw-bikes/web test -- CartSummary.test.tsx`
Expected: FAIL — the CTA is still the old disabled "Pagar" button with `title="Disponible próximamente"`.

- [ ] **Step 3: Update `CartSummary.tsx`**

Update the doc-comment (currently says the CTA stays `disabled` because checkout is fase 2) and replace the CTA block. The full new file:

```tsx
import type { PublicCart } from "@bw-bikes/shared";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { formatCurrencyCents } from "@/lib/format";

export interface CartSummaryProps {
  cart: PublicCart;
}

/**
 * Subtotal → descuento → IVA → envío → total, más los dos avisos que dependen
 * del contenido del carrito. El CTA lleva a `/checkout/envio`
 * (C1-checkout-datos.md); solo queda deshabilitado cuando `hasBlockingLines`
 * — no hay nada que pagar todavía.
 */
export function CartSummary({ cart }: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
      <h2 className="font-display text-h4 text-negro">Resumen</h2>

      <dl className="flex flex-col gap-xs font-body text-body text-negro">
        <div className="flex items-center justify-between">
          <dt className="text-grafito">Subtotal</dt>
          <dd>{formatCurrencyCents(cart.subtotalCents)}</dd>
        </div>

        {cart.discountCents > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-grafito">Descuento</dt>
            <dd>−{formatCurrencyCents(cart.discountCents)}</dd>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <dt className="text-grafito">IVA</dt>
          <dd>{formatCurrencyCents(cart.taxCents)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-grafito">Envío</dt>
          <dd>{cart.shippingCents === 0 ? "Gratis" : formatCurrencyCents(cart.shippingCents)}</dd>
        </div>

        <div className="mt-xs flex items-center justify-between border-t border-borde pt-xs font-ui text-ui text-negro">
          <dt>Total</dt>
          <dd>{formatCurrencyCents(cart.totalCents)}</dd>
        </div>
      </dl>

      {cart.captureMethod !== "automatic" ? (
        <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-caption text-estado-advertencia">
          Uno o más productos se confirman con el proveedor antes de cobrarse. El cargo se autoriza ahora y se
          confirma después.
        </p>
      ) : null}

      {cart.hasBlockingLines ? (
        <p className="flex items-center gap-xs rounded-control bg-estado-error-soft px-md py-sm font-body text-caption text-estado-error">
          <WarningCircle size={16} weight="regular" aria-hidden="true" className="shrink-0" />
          Ajusta los productos marcados para poder continuar.
        </p>
      ) : null}

      {cart.hasBlockingLines ? (
        <Button variant="primary" size="md" disabled title="Ajusta los productos marcados para poder continuar." className="w-full">
          Pagar
        </Button>
      ) : (
        <ButtonLink href="/checkout/envio" variant="primary" size="md" className="w-full">
          Ir a pagar
        </ButtonLink>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update `CartDrawer.tsx`'s doc-comment**

In `apps/web/src/components/cart/CartDrawer.tsx`, the component doc-comment currently reads:

```tsx
/**
 * Mounted once in `(storefront)/layout.tsx`, never per page (`B-carrito.md`
 * §6). No CTA de pago aquí — el checkout es fase 2 de M13, y `CartSummary`
 * (que sí la trae, `disabled`) vive en `/carrito`, no en el drawer.
 */
```

Replace the second sentence so it no longer claims checkout is unbuilt:

```tsx
/**
 * Mounted once en `(storefront)/layout.tsx`, never per page (`B-carrito.md`
 * §6). No CTA de pago aquí — la conversión completa vive en `/carrito` →
 * `CartSummary`, y de ahí a `/checkout` (C1-checkout-datos.md), nunca en el
 * drawer.
 */
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @bw-bikes/web test -- CartSummary.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full web suite once more**

Run: `pnpm --filter @bw-bikes/web test`
Expected: PASS — confirms nothing elsewhere in `components/cart` or `components/storefront/products` still asserts the old disabled/`"Disponible próximamente"` state (per C1 §7's note that this was the only remaining reference).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/cart/CartSummary.tsx apps/web/src/components/cart/CartSummary.test.tsx apps/web/src/components/cart/CartDrawer.tsx
git commit -m "feat(web): point the cart's payment CTA at /checkout/envio

The CartSummary button was disabled with 'Disponible próximamente'
since B-carrito.md — checkout now exists, so it links there. Still
disabled, with an honest reason, when the cart has blocking lines."
```

---

## Task 13: Final verification

No code changes — this is the C1 spec's own `## Verificación` section, run in full.

- [ ] **Step 1: Full API suite**

Run: `pnpm --filter @bw-bikes/api test`
Expected: PASS — every suite, old and new.

- [ ] **Step 2: Full web suite**

Run: `pnpm --filter @bw-bikes/web test`
Expected: PASS — every suite, old and new.

- [ ] **Step 3: Typecheck and lint, both packages**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS, zero errors, zero warnings treated as errors.

- [ ] **Step 4: Grep check — no stock figures leak into checkout markup**

Run: `grep -rn "available\b\|onHand" apps/web/src/components/checkout apps/web/src/app/\(checkout\)`
Expected: no matches (or only matches inside comments/type positions, never interpolated into rendered text) — same rule C1 §2 and B-carrito.md both hold the cart UI to.

- [ ] **Step 5: Grep check — no rhino/footer import inside the checkout route group**

Run: `grep -rln "brand/rhino\|components/storefront/footer" apps/web/src/app/\(checkout\) apps/web/src/components/checkout`
Expected: no matches — `DESIGN_SYSTEM.md:350`'s zero-rinoceronte, no-footer rule for checkout, made mechanically checkable.

- [ ] **Step 6: Manual walkthrough**

With `pnpm dev` running (both `api` and `web`) and the API's Mongo Atlas IP allow-listed:

1. Log in as a customer with an empty address book. Add a bike to the cart.
2. Click "Ir a pagar" from `/carrito` → lands on `/checkout/envio`.
3. Confirm the header has no navbar links, no cart button, no rhino, no footer.
4. Fill and save a new address → confirm in `/mi-cuenta/direcciones` that it's there and marked predeterminada.
5. Reload `/checkout/envio` → confirm it now shows that address pre-selected in "choose" mode, and clicking "Usar esta dirección" collapses it to "summary".
6. Add a second address from the checkout, confirm it becomes the new default (check `/mi-cuenta/direcciones`).
7. Check "Necesito factura", fill CFDI data, save → confirm the card collapses showing the RFC. Uncheck it → confirm it clears.
8. Confirm "Continuar al pago" is a real link now, pointed at `/checkout/pago` (which 404s until C2 exists — expected at this stage).
9. Go back to `/carrito`, remove the address's underlying purchasability if possible (or use a product marked `on_request`) to confirm the manual-capture notice text and the `hasBlockingLines` banner both render correctly and don't block navigation on their own.

Stop `pnpm dev` when done (per project convention — no background dev servers left running between sessions).

- [ ] **Step 7: Report to Manuel**

Summarize: what's now live at `/checkout/envio`, the one backend endpoint added (`DELETE /cart/billing-info`), and that `/checkout/pago` (C2) is the next planned session — link stays 404 until then.

---

## Self-Review Notes

**Spec coverage (C1-checkout-datos.md):** §0 layout → Tasks 6–11 build exactly the acordeón-de-dos-columnas shape. §1 route group → Task 6. §2 guard → Task 7. §3 shipping → Task 8. §4 billing → Task 9. §5 backend gap → Task 1. §6 summary → Task 10. §7 cart CTA → Task 12. Tests section → covered per-task plus Task 13's grep checks. Verificación → Task 13.

**Placeholder scan:** none — every step either contains complete, runnable code or a concrete shell command with an expected result.

**Type consistency:** `AddressFormErrors` (Task 4) is the type name used consistently in `AddressForm.tsx` (Task 4) and `ShippingAddressCard.tsx` (Task 8). `BillingFormErrors` (Task 5) is used consistently in `BillingInfoForm.tsx` (Task 5) and `BillingCard.tsx` (Task 9). `CartContextValue`'s three new methods (`setShippingAddress`, `setBillingInfo`, `removeBillingInfo` — Task 3) are called with those exact names in `ShippingAddressCard.tsx` (Task 8) and `BillingCard.tsx` (Task 9). `toShippingAddress` (Task 8) strips exactly the fields `ShippingAddress` (packages/shared) declares and none it doesn't.
