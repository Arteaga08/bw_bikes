import type { AuditAction, ColorTemplate as PublicColorTemplate, ProductVariant } from "@bw-bikes/shared";
import { logger } from "../config/logger.js";
import { ColorTemplate, MAX_COLOR_TEMPLATES, type IColorTemplate } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";

const MODULE_NAME = "catalog.color-templates";
const SORTABLE_FIELDS = ["order", "value", "createdAt"] as const;

interface ColorTemplateInput {
  value?: string;
  hex?: string;
  secondaryHex?: string | null;
  order?: number;
  isActive?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/** Admin-only by construction, same as `toSizeTemplateDto` — no public/admin split. */
export function toColorTemplateDto(template: IColorTemplate): PublicColorTemplate {
  return {
    id: String(template._id),
    value: template.value,
    hex: template.hex,
    secondaryHex: template.secondaryHex,
    source: template.source,
    order: template.order,
    isActive: template.isActive,
  };
}

/**
 * One collection, one engine — unlike `size-template.service.ts`'s
 * `createSizeTemplateService` factory (built to be instantiated twice, once
 * per catalog), `ColorTemplate` is shared by both catalogs (see its own
 * model doc comment), so this is a singleton service, same shape as
 * `brand.service.ts`.
 */
async function findByValue(value: string): Promise<IColorTemplate | null> {
  return ColorTemplate.findOne({ value: { $regex: `^${escapeRegex(value)}$`, $options: "i" } }).exec();
}

async function assertValueIsFree(value: string, selfId?: string): Promise<void> {
  const existing = await findByValue(value);
  if (existing && String(existing._id) !== selfId) {
    throw new AppError(`Ya existe un color con el valor "${value}".`, 409);
  }
}

async function findByIdOrFail(id: string): Promise<IColorTemplate> {
  const template = await ColorTemplate.findById(id).exec();
  if (!template) {
    throw new AppError("Color no encontrado.", 404);
  }
  return template;
}

async function list(query: Record<string, unknown>) {
  const { page, limit, skip, sort, search } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "order",
  });

  const filter: Record<string, unknown> = {};
  if (typeof query["isActive"] === "boolean") {
    filter["isActive"] = query["isActive"];
  }
  if (search) {
    filter["value"] = { $regex: escapeRegex(search), $options: "i" };
  }

  // `.lean()`: callers only ever map these through their plain-field DTO
  // functions — no document methods needed downstream.
  const [documents, total] = await Promise.all([
    ColorTemplate.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
    ColorTemplate.countDocuments(filter).exec(),
  ]);

  return { documents: documents as unknown as IColorTemplate[], meta: buildMeta(total, page, limit) };
}

async function create(input: ColorTemplateInput, actor: ActorContext): Promise<IColorTemplate> {
  const value = input.value!;
  await assertValueIsFree(value);

  const templateCount = await ColorTemplate.countDocuments().exec();
  if (templateCount >= MAX_COLOR_TEMPLATES) {
    throw new AppError(`No se pueden crear más de ${MAX_COLOR_TEMPLATES} colores.`, 400);
  }

  const template = await ColorTemplate.create({
    value,
    hex: input.hex!,
    secondaryHex: input.secondaryHex ?? null,
    source: "manual",
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.color_template_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(template._id),
    after: { value: template.value, hex: template.hex, secondaryHex: template.secondaryHex },
    ip: actor.ip,
  });

  return template;
}

async function update(id: string, input: ColorTemplateInput, actor: ActorContext): Promise<IColorTemplate> {
  const template = await findByIdOrFail(id);
  const before = { value: template.value, hex: template.hex, secondaryHex: template.secondaryHex };

  if (input.value !== undefined && input.value !== template.value) {
    await assertValueIsFree(input.value, id);
    template.value = input.value;
  }
  if (input.hex !== undefined) template.hex = input.hex;
  if (input.secondaryHex !== undefined) template.secondaryHex = input.secondaryHex;
  if (input.order !== undefined) template.order = input.order;
  if (input.isActive !== undefined) template.isActive = input.isActive;

  await template.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.color_template_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { value: template.value, hex: template.hex, secondaryHex: template.secondaryHex },
    ip: actor.ip,
  });

  return template;
}

/** No reference-integrity check needed, unlike `Brand.remove` — `ProductVariant.color` is free text with no FK, so removing a template only stops offering that chip; it never orphans a pointer. */
async function remove(id: string, actor: ActorContext): Promise<void> {
  const template = await findByIdOrFail(id);
  await template.deleteOne();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.color_template_deleted" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { value: template.value },
    ip: actor.ip,
  });
}

/**
 * Learns from a product's variants after it's saved, same discipline as
 * `size-template.service.ts`'s `learnSizeTemplates`: awaited by its callers,
 * but its own try/catch means a failure here can never fail a product save
 * that already succeeded. Called from both `bike.service.ts` and
 * `accessory.service.ts` — unlike sizes, there's only one collection, so
 * both catalogs feed the same templates.
 *
 * A color learned this way has no `hex` yet (`null`) — an admin gives it a
 * real value later on `/admin/catalogo/colores`; this never re-derives an
 * existing `manual` entry.
 */
async function learnColorTemplates(variants: ProductVariant[]): Promise<void> {
  try {
    const colors = new Set(
      variants.map((variant) => variant.color?.trim()).filter((color): color is string => Boolean(color)),
    );

    for (const value of colors) {
      const existing = await findByValue(value);
      if (existing) continue;

      const templateCount = await ColorTemplate.countDocuments().exec();
      if (templateCount >= MAX_COLOR_TEMPLATES) continue;

      await ColorTemplate.create({ value, hex: null, source: "auto", order: templateCount });
    }
  } catch (error) {
    logger.error({ err: error }, "[color-template] Failed to learn color templates from a product save");
  }
}

export const colorTemplateService = { list, findByIdOrFail, create, update, remove };
export { learnColorTemplates };
