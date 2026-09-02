"use client";

import type { BillingInfo, ItemType, PublicCart, ShippingAddress } from "@bw-bikes/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { ApiError } from "@/lib/api/error";

type CartStatus = "idle" | "loading" | "ready" | "anonymous" | "error";

interface CartState {
  cart: PublicCart | null;
  status: CartStatus;
  /** `${itemType}:${sku}` currently in flight, so a stepper/remove button can disable just its own line. */
  pendingKeys: string[];
  drawerOpen: boolean;
}

type CartAction =
  | { type: "loading" }
  | { type: "hydrated"; cart: PublicCart }
  | { type: "anonymous" }
  | { type: "error" }
  | { type: "mutation-start"; key: string }
  | { type: "mutation-settled"; key: string }
  | { type: "mutation-success"; key: string; cart: PublicCart }
  | { type: "open-drawer" }
  | { type: "close-drawer" };

function lineKey(itemType: ItemType, sku: string): string {
  return `${itemType}:${sku}`;
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "loading":
      return { ...state, status: "loading" };
    case "hydrated":
      return { ...state, cart: action.cart, status: "ready" };
    case "anonymous":
      return { ...state, cart: null, status: "anonymous" };
    case "error":
      return { ...state, status: "error" };
    case "mutation-start":
      return { ...state, pendingKeys: [...state.pendingKeys, action.key] };
    case "mutation-settled":
      return { ...state, pendingKeys: state.pendingKeys.filter((key) => key !== action.key) };
    case "mutation-success":
      // Replaces the cart wholesale — no optimistic update, no cache: the
      // backend is the only source of truth for prices, stock and totals.
      return { ...state, cart: action.cart, status: "ready" };
    case "open-drawer":
      return { ...state, drawerOpen: true };
    case "close-drawer":
      return { ...state, drawerOpen: false };
    default:
      return state;
  }
}

const INITIAL_STATE: CartState = { cart: null, status: "idle", pendingKeys: [], drawerOpen: false };

interface CartContextValue {
  cart: PublicCart | null;
  status: CartStatus;
  lineCount: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addLine: (itemType: ItemType, itemId: string, sku: string, qty: number) => Promise<void>;
  setQty: (itemType: ItemType, sku: string, qty: number) => Promise<void>;
  removeLine: (itemType: ItemType, sku: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  setShippingAddress: (address: ShippingAddress) => Promise<void>;
  setBillingInfo: (billingInfo: BillingInfo) => Promise<void>;
  removeBillingInfo: () => Promise<void>;
  refresh: () => Promise<void>;
  isPending: (itemType: ItemType, sku: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The signed-in customer's cart (B-carrito.md §3). Hydrated client-side only —
 * reading cookies in the layout would make the home dynamic and kill its ISR
 * (`publicApiFetch`'s `revalidate`) — and shared everywhere via context so a
 * single `GET /cart` on mount covers the whole storefront.
 *
 * `requestId` guards against two different buttons racing: `useAsyncAction`
 * already stops a single button's own double-click, but nothing stops the
 * navbar's stepper and a PDP's add-to-cart from resolving out of order if the
 * user fires both close together. Only the response from the most recent
 * mutation is ever applied.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { toast } = useToast();
  const requestId = useRef(0);

  const hydrate = useCallback(async (): Promise<void> => {
    dispatch({ type: "loading" });
    try {
      const cart = await getCart();
      dispatch({ type: "hydrated", cart });
    } catch (error) {
      if (error instanceof ApiError && error.httpStatus === 401) {
        dispatch({ type: "anonymous" });
        return;
      }
      dispatch({ type: "error" });
    }
  }, []);

  useEffect(() => {
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Repeats the same GET /cart the mount effect runs. Needed because the
   * Stripe webhook calls `emptyAfterCheckout` asynchronously — without this,
   * the navbar badge would keep showing already-purchased lines until the
   * next full page navigation (C2-checkout-pago.md §5).
   */
  const refresh = useCallback(() => hydrate(), [hydrate]);

  const runMutation = useCallback(
    async (key: string, mutate: () => Promise<PublicCart>): Promise<void> => {
      const thisRequestId = ++requestId.current;
      dispatch({ type: "mutation-start", key });

      try {
        const cart = await mutate();
        if (requestId.current === thisRequestId) {
          dispatch({ type: "mutation-success", key, cart });
        }
      } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 401) {
          dispatch({ type: "anonymous" });
          throw error;
        }
        if (error instanceof ApiError) {
          toast({ variant: "error", title: error.message });
        }
        throw error;
      } finally {
        dispatch({ type: "mutation-settled", key });
      }
    },
    [toast],
  );

  const addLine = useCallback(
    (itemType: ItemType, itemId: string, sku: string, qty: number) =>
      runMutation(lineKey(itemType, sku), () => addCartLine(itemType, itemId, sku, qty)),
    [runMutation],
  );

  const setQty = useCallback(
    (itemType: ItemType, sku: string, qty: number) => runMutation(lineKey(itemType, sku), () => updateCartLine(itemType, sku, qty)),
    [runMutation],
  );

  const removeLine = useCallback(
    (itemType: ItemType, sku: string) => runMutation(lineKey(itemType, sku), () => removeCartLine(itemType, sku)),
    [runMutation],
  );

  const applyCoupon = useCallback((code: string) => runMutation("coupon", () => applyCartCoupon(code)), [runMutation]);

  const removeCoupon = useCallback(() => runMutation("coupon", () => removeCartCoupon()), [runMutation]);

  const setShippingAddress = useCallback(
    (address: ShippingAddress) => runMutation("shipping-address", () => setCartShippingAddress(address)),
    [runMutation],
  );

  const setBillingInfo = useCallback(
    (billingInfo: BillingInfo) => runMutation("billing-info", () => setCartBillingInfo(billingInfo)),
    [runMutation],
  );

  const removeBillingInfo = useCallback(() => runMutation("billing-info", () => removeCartBillingInfo()), [runMutation]);

  const openDrawer = useCallback(() => dispatch({ type: "open-drawer" }), []);
  const closeDrawer = useCallback(() => dispatch({ type: "close-drawer" }), []);

  const isPending = useCallback((itemType: ItemType, sku: string) => state.pendingKeys.includes(lineKey(itemType, sku)), [state.pendingKeys]);

  const lineCount = state.cart?.lines.reduce((sum, line) => sum + line.qty, 0) ?? 0;

  const value = useMemo<CartContextValue>(
    () => ({
      cart: state.cart,
      status: state.status,
      lineCount,
      drawerOpen: state.drawerOpen,
      openDrawer,
      closeDrawer,
      addLine,
      setQty,
      removeLine,
      applyCoupon,
      removeCoupon,
      setShippingAddress,
      setBillingInfo,
      removeBillingInfo,
      refresh,
      isPending,
    }),
    [
      state.cart,
      state.status,
      state.drawerOpen,
      lineCount,
      openDrawer,
      closeDrawer,
      addLine,
      setQty,
      removeLine,
      applyCoupon,
      removeCoupon,
      setShippingAddress,
      setBillingInfo,
      removeBillingInfo,
      refresh,
      isPending,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de CartProvider.");
  }
  return context;
}
