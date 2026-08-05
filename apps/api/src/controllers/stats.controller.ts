import type { Request, Response } from "express";
import {
  getApplicationsStats,
  getInventoryStats,
  getOperationalAlerts,
  getOrdersStats,
  getPreferencesStats,
  getStatsOverview,
} from "../services/stats/index.js";
import { asyncHandler, parseStatsRange, sendResponse } from "../utils/index.js";

/**
 * Every handler resolves its own window via `parseStatsRange(req.query)` —
 * each is an independent request, so each gets its own resolution. What
 * guarantees two charts on the *same panel render* agree is the frontend
 * calling `/overview` (which resolves once and hands the same range to
 * every module internally) rather than stitching together separate calls to
 * these per-module endpoints for a single view.
 */

export const getOrdersStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getOrdersStats(parseStatsRange(req.query));
  sendResponse(res, 200, "Estadísticas de órdenes obtenidas.", { stats });
});

export const getInventoryStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getInventoryStats(parseStatsRange(req.query));
  sendResponse(res, 200, "Estadísticas de inventario obtenidas.", { stats });
});

export const getApplicationsStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getApplicationsStats(parseStatsRange(req.query));
  sendResponse(res, 200, "Estadísticas de solicitudes obtenidas.", { stats });
});

export const getPreferencesStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getPreferencesStats(parseStatsRange(req.query));
  sendResponse(res, 200, "Estadísticas de preferencias obtenidas.", { stats });
});

/** Unwindowed on purpose — see `stats/alerts.stats.ts`. */
export const getOperationalAlertsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const alerts = await getOperationalAlerts();
  sendResponse(res, 200, "Alertas operativas obtenidas.", { alerts });
});

export const getStatsOverviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const overview = await getStatsOverview(parseStatsRange(req.query));
  sendResponse(res, 200, "Resumen de estadísticas obtenido.", { overview });
});
