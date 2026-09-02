import type { BillingInfo, CartLineInput, ItemType, ShippingAddress } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { cartService } from "../services/cart.service.js";
import { AppError, asyncHandler, routeParam, sendResponse } from "../utils/index.js";

/**
 * The cart always belongs to the authenticated customer, never to an id in the
 * request. There is no `/cart/:id` route in this module at all — the only cart
 * anyone can address is their own, which makes IDOR on carts structurally
 * impossible rather than something a check has to catch.
 */
function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError("No autenticado.", 401);
  }
  return req.user.id;
}

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(requireUserId(req));
  sendResponse(res, 200, "Carrito obtenido.", { cart });
});

export const addCartLine = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addLine(requireUserId(req), req.body as CartLineInput);
  sendResponse(res, 201, "Producto agregado al carrito.", { cart });
});

/**
 * The customer types a code; the server decides what it is worth. The body
 * carries no amount, for the same reason no cart route carries a price.
 */
export const applyCartCoupon = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.applyCoupon(requireUserId(req), (req.body as { code: string }).code);
  sendResponse(res, 200, "Cupón aplicado.", { cart });
});

export const removeCartCoupon = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeCoupon(requireUserId(req));
  sendResponse(res, 200, "Cupón eliminado del carrito.", { cart });
});

export const updateCartLine = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateLine(
    requireUserId(req),
    routeParam(req, "itemType") as ItemType,
    routeParam(req, "sku"),
    (req.body as { qty: number }).qty,
  );
  sendResponse(res, 200, "Cantidad actualizada.", { cart });
});

export const removeCartLine = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeLine(
    requireUserId(req),
    routeParam(req, "itemType") as ItemType,
    routeParam(req, "sku"),
  );
  sendResponse(res, 200, "Producto eliminado del carrito.", { cart });
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.clearCart(requireUserId(req));
  sendResponse(res, 200, "Carrito vaciado.", { cart });
});

export const setCartShippingAddress = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.setShippingAddress(requireUserId(req), req.body as ShippingAddress);
  sendResponse(res, 200, "Dirección de envío guardada.", { cart });
});

export const setCartBillingInfo = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.setBillingInfo(requireUserId(req), req.body as BillingInfo);
  sendResponse(res, 200, "Datos de facturación guardados.", { cart });
});

export const removeCartBillingInfo = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeBillingInfo(requireUserId(req));
  sendResponse(res, 200, "Datos de facturación eliminados.", { cart });
});

export { requireUserId };
