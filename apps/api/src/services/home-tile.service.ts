import type { AdminHomeTile, AuditAction, CategoryImage, HomeTileSlot, PublicHomeTile } from "@bw-bikes/shared";
import { HOME_TILE_SLOTS } from "@bw-bikes/shared";
import { HomeTile, type IHomeTile } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { deleteImage } from "./storage/index.js";

const MODULE_NAME = "content.home_tiles";

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

function toAdminHomeTile(tile: IHomeTile): AdminHomeTile {
  return {
    slot: tile.slot,
    ...(tile.image ? { image: tile.image as CategoryImage } : {}),
    updatedAt: tile.updatedAt.toISOString(),
  };
}

/**
 * Finds the doc for a slot, creating it empty if this is the first time
 * anything has touched it — the two slots always exist conceptually
 * (`HOME_TILE_SLOTS` is fixed), the collection just lazily catches up.
 * `upsert` is safe against the double-create race because `slot` is unique:
 * a concurrent second insert fails at the DB and the caller re-reads.
 */
async function findOrCreateBySlot(slot: HomeTileSlot): Promise<IHomeTile> {
  return HomeTile.findOneAndUpdate({ slot }, { $setOnInsert: { slot } }, { upsert: true, new: true }).exec();
}

/** All slots, always exactly `HOME_TILE_SLOTS.length` — the admin screen never shows more or fewer than two tiles. */
async function listAdmin(): Promise<AdminHomeTile[]> {
  const tiles = await Promise.all(HOME_TILE_SLOTS.map((slot) => findOrCreateBySlot(slot)));
  return tiles.map(toAdminHomeTile);
}

/**
 * Only slots with a photo — same "admin controls what appears by uploading
 * it" degrade contract as `HomeCategories`/`HomeBrands`. Ordered by
 * `HOME_TILE_SLOTS` (bikes, then accessories) rather than Mongo's find()
 * order, which isn't guaranteed to match insertion order.
 */
async function listPublic(): Promise<PublicHomeTile[]> {
  const tiles = await HomeTile.find({ slot: { $in: HOME_TILE_SLOTS } }).exec();
  const bySlot = new Map(tiles.map((tile) => [tile.slot, tile]));

  const publicTiles: PublicHomeTile[] = [];
  for (const slot of HOME_TILE_SLOTS) {
    const image = bySlot.get(slot)?.image;
    if (image) publicTiles.push({ slot, image: image as CategoryImage });
  }
  return publicTiles;
}

/** Save-then-delete-old-asset, same order as `brand.service.ts`'s `setLogo` — a failed remote delete orphans an asset rather than leaving the tile pointing at nothing. */
async function setImage(slot: HomeTileSlot, image: CategoryImage, actor: ActorContext): Promise<AdminHomeTile> {
  const tile = await findOrCreateBySlot(slot);
  const previousPublicId = tile.image?.publicId;

  tile.image = image;
  await tile.save();

  if (previousPublicId && previousPublicId !== image.publicId) {
    await deleteImage(previousPublicId);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.home_tile_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: slot,
    after: { publicId: image.publicId },
    ip: actor.ip,
  });

  return toAdminHomeTile(tile);
}

async function removeImage(slot: HomeTileSlot, actor: ActorContext): Promise<AdminHomeTile> {
  const tile = await findOrCreateBySlot(slot);
  if (!tile.image) {
    throw new AppError("La tarjeta no tiene imagen.", 409);
  }
  const publicId = tile.image.publicId;

  tile.image = undefined;
  await tile.save();
  await deleteImage(publicId);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.home_tile_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: slot,
    before: { publicId },
    ip: actor.ip,
  });

  return toAdminHomeTile(tile);
}

export const homeTileService = { listAdmin, listPublic, setImage, removeImage };
