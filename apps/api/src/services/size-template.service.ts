import type { AuditAction, ProductVariant, SizeTemplate as PublicSizeTemplate } from "@bw-bikes/shared";
import type { Model } from "mongoose";
import { logger } from "../config/logger.js";
import { type ISizeTemplate, MAX_SIZE_TEMPLATES } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";

const SORTABLE_FIELDS = ["order", "value", "createdAt"] as const;

interface SizeTemplateInput {
  value?: string;
  order?: number;
  isActive?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/** Admin-only by construction (see `SizeTemplate`'s own doc comment) — no public/admin split, unlike `toPublicBrand`/`toAdminBrand`. */
export function toSizeTemplateDto(template: ISizeTemplate): PublicSizeTemplate {
  return {
    id: String(template._id),
    value: template.value,
    source: template.source,
    order: template.order,
    isActive: template.isActive,
  };
}

/**
 * One CRUD engine, instantiated once per size catalog (bikes, accessories) —
 * same shape as `createCategoryService`. The two catalogs stay genuinely
 * independent — separate collections, separate `value` uniqueness scopes —
 * while the rules that govern them are written once. `moduleName` only labels
 * the audit entries, so a reader can tell which catalog a change belongs to.
 */
export function createSizeTemplateService(SizeTemplate: Model<ISizeTemplate>, moduleName: string) {
  async function findByValue(value: string): Promise<ISizeTemplate | null> {
    return SizeTemplate.findOne({ value: { $regex: `^${escapeRegex(value)}$`, $options: "i" } }).exec();
  }

  async function assertValueIsFree(value: string, selfId?: string): Promise<void> {
    const existing = await findByValue(value);
    if (existing && String(existing._id) !== selfId) {
      throw new AppError(`Ya existe una talla con el valor "${value}".`, 409);
    }
  }

  async function findByIdOrFail(id: string): Promise<ISizeTemplate> {
    const template = await SizeTemplate.findById(id).exec();
    if (!template) {
      throw new AppError("Talla no encontrada.", 404);
    }
    return template;
  }

  async function list(query: Record<string, unknown>, options: { publicOnly: boolean }) {
    const { page, limit, skip, sort, search } = parseListQuery(query, {
      allowedSortFields: SORTABLE_FIELDS,
      defaultSort: "order",
    });

    const filter: Record<string, unknown> = {};
    if (options.publicOnly) {
      filter["isActive"] = true;
    } else if (typeof query["isActive"] === "boolean") {
      filter["isActive"] = query["isActive"];
    }

    if (search) {
      filter["value"] = { $regex: escapeRegex(search), $options: "i" };
    }

    // `.lean()`: callers only ever map these through their plain-field DTO
    // functions — no document methods needed downstream.
    const [documents, total] = await Promise.all([
      SizeTemplate.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      SizeTemplate.countDocuments(filter).exec(),
    ]);

    return { documents: documents as unknown as ISizeTemplate[], meta: buildMeta(total, page, limit) };
  }

  async function create(input: SizeTemplateInput, actor: ActorContext): Promise<ISizeTemplate> {
    const value = input.value!;
    await assertValueIsFree(value);

    const templateCount = await SizeTemplate.countDocuments().exec();
    if (templateCount >= MAX_SIZE_TEMPLATES) {
      throw new AppError(`No se pueden crear más de ${MAX_SIZE_TEMPLATES} tallas.`, 400);
    }

    const template = await SizeTemplate.create({
      value,
      source: "manual",
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
    });

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.size_template_created" satisfies AuditAction,
      module: moduleName,
      targetId: String(template._id),
      after: { value: template.value },
      ip: actor.ip,
    });

    return template;
  }

  async function update(id: string, input: SizeTemplateInput, actor: ActorContext): Promise<ISizeTemplate> {
    const template = await findByIdOrFail(id);
    const before = { value: template.value };

    if (input.value !== undefined && input.value !== template.value) {
      await assertValueIsFree(input.value, id);
      template.value = input.value;
    }
    if (input.order !== undefined) template.order = input.order;
    if (input.isActive !== undefined) template.isActive = input.isActive;

    await template.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.size_template_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before,
      after: { value: template.value },
      ip: actor.ip,
    });

    return template;
  }

  async function remove(id: string, actor: ActorContext): Promise<void> {
    const template = await findByIdOrFail(id);
    await template.deleteOne();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.size_template_deleted" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { value: template.value },
      ip: actor.ip,
    });
  }

  /**
   * Learns from a product's variants after it's saved — never before: this is
   * memory, not validation, so it must never be able to block the write that
   * triggered it. Awaited by its callers, same discipline as
   * `learnSpecTemplates`/`recordAuditLog` — not fire-and-forget, so it's done
   * by the time the response goes out, but its own try/catch below means a
   * failure here can never fail a product save that already succeeded.
   *
   * Each distinct, non-empty `size` among the variants gets its own template:
   * an existing one (case-insensitive match) is left untouched — never
   * re-derived from `manual` to `auto` — and a size never seen before becomes
   * a new `auto` template, unless the collection is already at its cap, in
   * which case learning silently no-ops rather than blocking the product save
   * the way a hard limit on a foreground write would.
   */
  async function learnSizeTemplates(variants: ProductVariant[]): Promise<void> {
    try {
      const sizes = new Set(
        variants.map((variant) => variant.size?.trim()).filter((size): size is string => Boolean(size)),
      );

      for (const value of sizes) {
        const existing = await findByValue(value);
        if (existing) continue;

        const templateCount = await SizeTemplate.countDocuments().exec();
        if (templateCount >= MAX_SIZE_TEMPLATES) continue;

        await SizeTemplate.create({ value, source: "auto", order: templateCount });
      }
    } catch (error) {
      logger.error({ err: error }, "[size-template] Failed to learn size templates from a product save");
    }
  }

  return { list, findByIdOrFail, create, update, remove, learnSizeTemplates };
}

export type SizeTemplateService = ReturnType<typeof createSizeTemplateService>;
