import type { OrderPriority, OrderStatus, ShippingAddress } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import type { RecordShipmentInput } from "../services/order.service.js";
import { orderService } from "../services/order.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireUserId } from "./cart.controller.js";
import { requireActor } from "./category.controller.js";

/** Header name for the checkout idempotency key, matching the convention gateways use. */
const IDEMPOTENCY_HEADER = "idempotency-key";

function idempotencyKey(req: Request): string | undefined {
  const value = req.get(IDEMPOTENCY_HEADER);
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 120) : undefined;
}

/**
 * Checkout. The request body carries **nothing about money** — not an amount,
 * not a currency, not even the lines. The server reads the customer's own cart
 * and prices it from the catalog, which is what makes the charged total
 * impossible to influence from outside.
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.createFromCart(
    requireUserId(req),
    { idempotencyKey: idempotencyKey(req) },
    requireActor(req),
  );

  sendResponse(res, 201, "Orden creada. Completa el pago para confirmarla.", result);
});

export const listMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const { orders, meta } = await orderService.listForUser(requireUserId(req), req.query);
  sendResponse(res, 200, "Órdenes obtenidas.", { orders }, meta);
});

/**
 * Anti-IDOR lives in the service, where the owner is part of the query filter
 * rather than a check applied after loading — and the answer for someone
 * else's order is 404, never 403.
 */
export const getMyOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getForUser(requireUserId(req), routeParam(req, "id"));
  sendResponse(res, 200, "Orden obtenida.", { order });
});

export const listOrdersForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { orders, meta } = await orderService.listForAdmin(req.query);
  sendResponse(res, 200, "Órdenes obtenidas.", { orders }, meta);
});

/** Unwindowed KPI counts for the four summary tiles — see `orderService.getSummary`'s doc comment. */
export const getOrdersSummaryForAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await orderService.getSummary();
  sendResponse(res, 200, "Resumen de órdenes obtenido.", { summary });
});

export const getOrderForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getForAdmin(routeParam(req, "id"));
  sendResponse(res, 200, "Orden obtenida.", { order });
});

export const getOrderActivityForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const activity = await orderService.getActivity(routeParam(req, "id"));
  sendResponse(res, 200, "Bitácora obtenida.", { activity });
});

/** Supplier confirmed: capture the held funds. */
export const confirmSupplierStock = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.confirmSupplierStock(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Stock confirmado y pago capturado.", { order });
});

/** No stock: drop the authorization so the customer is never charged. */
export const rejectSupplierStock = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.rejectSupplierStock(
    routeParam(req, "id"),
    (req.body as { reason: string }).reason,
    requireActor(req),
  );
  sendResponse(res, 200, "Autorización cancelada y unidades liberadas.", { order });
});

export const updateOrderShippingAddress = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateShippingAddress(
    routeParam(req, "id"),
    req.body as ShippingAddress,
    requireActor(req),
  );
  sendResponse(res, 200, "Dirección de envío actualizada.", { order });
});

export const recordOrderShipment = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.recordShipment(
    routeParam(req, "id"),
    req.body as RecordShipmentInput,
    requireActor(req),
  );
  sendResponse(res, 200, "Paquetería capturada.", { order });
});

export const bulkUpdateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { orderIds, status, reason } = req.body as { orderIds: string[]; status: OrderStatus; reason?: string };
  const result = await orderService.bulkUpdateStatus(orderIds, status, reason, requireActor(req));
  sendResponse(res, 200, "Actualización masiva procesada.", result);
});

export const updateOrderPriority = asyncHandler(async (req: Request, res: Response) => {
  const { priority } = req.body as { priority: OrderPriority };
  const order = await orderService.updatePriority(routeParam(req, "id"), priority, requireActor(req));
  sendResponse(res, 200, "Prioridad actualizada.", { order });
});

export const addOrderInternalNote = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.body as { body: string };
  const note = await orderService.addInternalNote(routeParam(req, "id"), body, requireActor(req));
  sendResponse(res, 201, "Nota agregada.", { note });
});
