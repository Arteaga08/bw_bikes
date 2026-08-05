import { Router } from "express";
import {
  listMyApplications,
  submitAmbassadorApplication,
  submitSponsorshipApplication,
} from "../controllers/application.controller.js";
import { applicationRateLimiter, protect, uploadAttachments, validate } from "../middlewares/index.js";
import { ambassadorApplicationSchema, sponsorshipApplicationSchema } from "../validators/index.js";

/**
 * Ambassador and event-sponsorship applications — "solo con cuenta" per the
 * spec, so the cooldown anchors to a real `userId` rather than an email a
 * script can rotate. `protect` on the whole router.
 *
 * Upload runs **before** `validate`: multer has to parse the multipart body
 * first, or `req.body` is empty when Joi looks at it — same ordering as the
 * catalog gallery routes.
 */
const router = Router();

router.use(protect);

router.post(
  "/ambassador",
  applicationRateLimiter,
  uploadAttachments,
  validate(ambassadorApplicationSchema),
  submitAmbassadorApplication,
);

router.post(
  "/sponsorship",
  applicationRateLimiter,
  uploadAttachments,
  validate(sponsorshipApplicationSchema),
  submitSponsorshipApplication,
);

router.get("/mine", listMyApplications);

export { router as applicationRouter };
