import { PassThrough } from "node:stream";
import { vi } from "vitest";
import { cloudinary } from "../../src/config/cloudinary.js";

/**
 * Stubs the Cloudinary SDK at its boundary so no test reaches the network.
 *
 * Cloudinary is a hard dependency of this API (`loadEnv()` refuses to boot
 * without credentials), so there is no stub adapter in `src/` to fall back
 * on — the seam is here, in the tests, at the single call the storage service
 * makes. That's deliberate: the code under test is the real code path,
 * including the magic-byte and EXIF stages that run *before* this stub is ever
 * reached.
 *
 * Returned spies let a test assert that a rejected upload never called out at
 * all, which is the sharper version of "the forged file was rejected".
 */
export function stubCloudinary() {
  let counter = 0;

  const uploadSpy = vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
    options: { folder?: string },
    callback: (error: unknown, result?: Record<string, unknown>) => void,
  ) => {
    const stream = new PassThrough();
    stream.on("finish", () => {
      counter += 1;
      callback(undefined, {
        public_id: `${options.folder ?? "bw-bikes"}/asset-${counter}`,
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${options.folder ?? ""}/asset-${counter}.jpg`,
        width: 12,
        height: 8,
      });
    });
    // Drain, so `finish` fires once storage.service calls `stream.end(buffer)`.
    stream.resume();
    return stream;
  }) as never);

  const destroySpy = vi
    .spyOn(cloudinary.uploader, "destroy")
    .mockImplementation((async () => ({ result: "ok" })) as never);

  return { uploadSpy, destroySpy };
}
