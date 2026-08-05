import type { ItemType, ProductViewInput } from "@bw-bikes/shared";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { Accessory, Bike, ProductView } from "../models/index.js";

/** Same narrowing as `inventory.service.ts`'s `CATALOG_MODELS`: only the shape this file actually reads. */
type ViewableProduct = { _id: unknown; isActive: boolean; variants: { sku: string; isActive: boolean }[] };

const CATALOG_MODELS: Record<ItemType, Model<ViewableProduct>> = {
  bike: Bike as unknown as Model<ViewableProduct>,
  accessory: Accessory as unknown as Model<ViewableProduct>,
};

/**
 * Records an anonymous "someone looked at this" event, or silently does
 * nothing.
 *
 * The two outcomes are indistinguishable to the caller **on purpose** — see
 * `catalog.route.ts` / `recordProductView`. A nonexistent id, an archived
 * product, or a SKU that doesn't resolve to a real variant all take this
 * same quiet path rather than a 404, because a 404 here would turn a public,
 * unauthenticated endpoint into an oracle for which product ids exist
 * (BACKEND_SECURITY_GUIDELINES.md's anti-enumeration rule).
 */
async function recordView(input: ProductViewInput): Promise<void> {
  if (!Types.ObjectId.isValid(input.itemId)) return;

  const catalogModel = CATALOG_MODELS[input.itemType];
  const product = await catalogModel.findOne({ _id: input.itemId, isActive: true }).exec();
  if (!product) return;

  const sku = input.sku?.toUpperCase();
  if (sku !== undefined) {
    const variant = product.variants.find((candidate) => candidate.sku === sku);
    if (!variant || !variant.isActive) return;
  }

  await ProductView.create({
    itemType: input.itemType,
    itemId: product._id,
    ...(sku !== undefined ? { sku } : {}),
    ...(input.size !== undefined ? { size: input.size } : {}),
  });
}

export const productViewService = { recordView };
