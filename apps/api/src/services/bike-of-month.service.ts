import type { AdminBikeOfMonth, AuditAction, BikeOfMonthInput, CategoryImage, PublicBikeOfMonth } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { Bike, BikeOfMonth, type IBikeOfMonth } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { deleteImage } from "./storage/index.js";

const MODULE_NAME = "content.bike_of_month";

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/**
 * Finds the singleton doc, creating it empty on first touch — same
 * lazy-upsert pattern as `home-tile.service.ts`'s `findOrCreateBySlot`, just
 * with no `slot` to key on since there is only ever one document.
 */
async function findOrCreate(): Promise<IBikeOfMonth> {
  return BikeOfMonth.findOneAndUpdate({}, { $setOnInsert: {} }, { upsert: true, new: true }).exec();
}

/**
 * Resolves the referenced bike to a storefront path, or `null` if there is no
 * bike set, or the one that's set no longer exists / is inactive / archived
 * — same criteria `hero-slide.service.ts`'s `resolveHrefs` applies to a
 * `"bike"`-type CTA target.
 */
async function resolveHref(bikeId: Types.ObjectId | undefined): Promise<string | null> {
  if (!bikeId) return null;
  const bike = await Bike.findById(bikeId).select("slug isActive archivedAt").lean().exec();
  if (!bike || !bike.isActive || bike.archivedAt) return null;
  return `/bicicletas/${bike.slug}`;
}

function toAdmin(doc: IBikeOfMonth, href: string | null): AdminBikeOfMonth {
  return {
    ...(doc.image ? { image: doc.image as CategoryImage } : {}),
    ...(doc.eyebrow ? { eyebrow: doc.eyebrow } : {}),
    ...(doc.title ? { title: doc.title } : {}),
    ...(doc.subtitle ? { subtitle: doc.subtitle } : {}),
    ...(doc.bikeId ? { bikeId: String(doc.bikeId) } : {}),
    href,
    isBroken: href === null && Boolean(doc.bikeId),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function getAdmin(): Promise<AdminBikeOfMonth> {
  const doc = await findOrCreate();
  const href = await resolveHref(doc.bikeId);
  return toAdmin(doc, href);
}

/**
 * Never published unless there's an image, a title, and a working `href` —
 * an incomplete banner (no photo, no headline, or a dead button) is worse
 * than no banner at all, same "admin controls existence by finishing the
 * content" contract as every other home section.
 */
async function getPublic(): Promise<PublicBikeOfMonth | null> {
  const doc = await findOrCreate();
  if (!doc.image || !doc.title) return null;

  const href = await resolveHref(doc.bikeId);
  if (!href) return null;

  return {
    image: doc.image as CategoryImage,
    ...(doc.eyebrow ? { eyebrow: doc.eyebrow } : {}),
    title: doc.title,
    ...(doc.subtitle ? { subtitle: doc.subtitle } : {}),
    href,
  };
}

/** Refuses a `bikeId` that doesn't exist at save time — mirrors `hero-slide.service.ts`'s `assertTargetsExist`. */
async function assertBikeExists(bikeId: string | undefined): Promise<void> {
  if (!bikeId) return;
  const exists = await Bike.exists({ _id: bikeId }).exec();
  if (!exists) {
    throw new AppError("La bici seleccionada ya no existe en el catálogo.", 400);
  }
}

async function updateText(input: BikeOfMonthInput, actor: ActorContext): Promise<AdminBikeOfMonth> {
  await assertBikeExists(input.bikeId);

  const doc = await findOrCreate();
  const before = { title: doc.title, bikeId: doc.bikeId ? String(doc.bikeId) : null };

  doc.eyebrow = input.eyebrow;
  doc.title = input.title;
  doc.subtitle = input.subtitle;
  doc.bikeId = input.bikeId ? new Types.ObjectId(input.bikeId) : undefined;
  await doc.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.bike_of_month_updated" satisfies AuditAction,
    module: MODULE_NAME,
    before,
    after: { title: doc.title, bikeId: doc.bikeId ? String(doc.bikeId) : null },
    ip: actor.ip,
  });

  const href = await resolveHref(doc.bikeId);
  return toAdmin(doc, href);
}

/** Save-then-delete-old-asset, same order as `home-tile.service.ts`'s `setImage`. */
async function setImage(image: CategoryImage, actor: ActorContext): Promise<AdminBikeOfMonth> {
  const doc = await findOrCreate();
  const previousPublicId = doc.image?.publicId;

  doc.image = image;
  await doc.save();

  if (previousPublicId && previousPublicId !== image.publicId) {
    await deleteImage(previousPublicId);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.bike_of_month_updated" satisfies AuditAction,
    module: MODULE_NAME,
    after: { publicId: image.publicId },
    ip: actor.ip,
  });

  const href = await resolveHref(doc.bikeId);
  return toAdmin(doc, href);
}

async function removeImage(actor: ActorContext): Promise<AdminBikeOfMonth> {
  const doc = await findOrCreate();
  if (!doc.image) {
    throw new AppError("El banner no tiene imagen.", 409);
  }
  const publicId = doc.image.publicId;

  doc.image = undefined;
  await doc.save();
  await deleteImage(publicId);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.bike_of_month_updated" satisfies AuditAction,
    module: MODULE_NAME,
    before: { publicId },
    ip: actor.ip,
  });

  const href = await resolveHref(doc.bikeId);
  return toAdmin(doc, href);
}

export const bikeOfMonthService = { getAdmin, getPublic, updateText, setImage, removeImage };
