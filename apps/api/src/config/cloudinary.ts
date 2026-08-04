import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

/**
 * Single place the Cloudinary SDK is configured, per
 * BACKEND_ARCHITECTURE_GUIDELINES.md §"Integraciones externas": no service or
 * controller talks to the SDK directly — they go through
 * `services/storage/storage.service.ts`, which is the only consumer of this
 * module.
 *
 * `secure: true` forces https delivery URLs; a mixed-content image would be
 * blocked by the storefront's own CSP anyway.
 *
 * Skipped entirely when credentials are absent (only possible outside
 * production — see `PRODUCTION_REQUIRED_VARS` in config/env.ts). The storage
 * service refuses the operation before it ever reaches the SDK in that case,
 * so configuring it with empty strings would only produce a confusing auth
 * error further down.
 */
if (env.isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

/** Folder prefix for every asset this project uploads, keeping the media library tidy. */
export const CLOUDINARY_ROOT_FOLDER = "bw-bikes";

export { cloudinary };
