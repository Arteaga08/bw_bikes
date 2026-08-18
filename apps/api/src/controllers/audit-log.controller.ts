import type { Request, Response } from "express";
import { listAuditLogs } from "../services/audit-log.service.js";
import { asyncHandler, sendResponse } from "../utils/index.js";

export const listAdminAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { logs, meta } = await listAuditLogs(req.query);
  sendResponse(res, 200, "Bitácora obtenida.", { logs }, meta);
});
