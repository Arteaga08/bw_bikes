import type { AmbassadorDetails, SponsorshipDetails } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { applicationService } from "../services/application.service.js";
import type { ApplicationAttachmentInput } from "../services/application.service.js";
import { uploadAttachments as uploadAttachmentsToStorage } from "../services/storage/index.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireUserId } from "./cart.controller.js";
import { requireActor } from "./category.controller.js";
import { readOptionalUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";

const CLOUDINARY_FOLDER = "applications";

/**
 * Uploads whatever files rode along with the request (zero is fine — the
 * attachments are optional) and pairs each Cloudinary result back up with the
 * original filename multer parsed, since `uploadAttachments` only returns
 * what Cloudinary itself reports.
 */
async function collectAttachments(req: Request): Promise<ApplicationAttachmentInput[]> {
  const files = readOptionalUploadedFiles(req);
  if (files.length === 0) return [];

  const uploaded = await uploadAttachmentsToStorage(files, CLOUDINARY_FOLDER);
  return uploaded.map((result, index) => ({
    publicId: result.publicId,
    format: result.format,
    originalName: files[index]!.originalname,
  }));
}

export const submitAmbassadorApplication = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const attachments = await collectAttachments(req);

  const application = await applicationService.submitAmbassadorApplication(
    requireUserId(req),
    req.body as AmbassadorDetails,
    attachments,
    requireActor(req),
  );

  sendResponse(res, 201, "Solicitud de embajador enviada.", { application });
});

export const submitSponsorshipApplication = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const attachments = await collectAttachments(req);

  const application = await applicationService.submitSponsorshipApplication(
    requireUserId(req),
    req.body as SponsorshipDetails,
    attachments,
    requireActor(req),
  );

  sendResponse(res, 201, "Solicitud de patrocinio enviada.", { application });
});

export const listMyApplications = asyncHandler(async (req: Request, res: Response) => {
  const applications = await applicationService.listForUser(requireUserId(req));
  sendResponse(res, 200, "Solicitudes obtenidas.", { applications });
});

export const listApplicationsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { applications, meta } = await applicationService.listForAdmin(req.query);
  sendResponse(res, 200, "Solicitudes obtenidas.", { applications }, meta);
});

export const getApplicationForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.getForAdmin(routeParam(req, "id"));
  sendResponse(res, 200, "Solicitud obtenida.", { application });
});

export const approveApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.approve(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Solicitud aprobada.", { application });
});

export const rejectApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.reject(
    routeParam(req, "id"),
    (req.body as { reason: string }).reason,
    requireActor(req),
  );
  sendResponse(res, 200, "Solicitud rechazada.", { application });
});
