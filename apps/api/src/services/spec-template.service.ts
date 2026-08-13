import type { AuditAction, SpecGroup, SpecTemplate as PublicSpecTemplate } from "@bw-bikes/shared";
import { logger } from "../config/logger.js";
import { type ISpecTemplate, MAX_SPEC_TEMPLATES, SpecTemplate } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";

const MODULE_NAME = "catalog.spec-templates";
const SORTABLE_FIELDS = ["order", "title", "createdAt"] as const;

interface SpecTemplateInput {
  title?: string;
  fields?: Array<{ label: string; order: number }>;
  order?: number;
  isActive?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/** Admin-only by construction (see `SpecTemplate`'s own doc comment) — no public/admin split, unlike `toPublicBrand`/`toAdminBrand`. */
export function toSpecTemplateDto(template: ISpecTemplate): PublicSpecTemplate {
  return {
    id: String(template._id),
    title: template.title,
    fields: template.fields.map((field) => ({ label: field.label, order: field.order })),
    source: template.source,
    order: template.order,
    isActive: template.isActive,
  };
}

async function findByTitle(title: string): Promise<ISpecTemplate | null> {
  return SpecTemplate.findOne({ title: { $regex: `^${escapeRegex(title)}$`, $options: "i" } }).exec();
}

async function assertTitleIsFree(title: string, selfId?: string): Promise<void> {
  const existing = await findByTitle(title);
  if (existing && String(existing._id) !== selfId) {
    throw new AppError(`Ya existe una plantilla con el título "${title}".`, 409);
  }
}

async function findByIdOrFail(id: string): Promise<ISpecTemplate> {
  const template = await SpecTemplate.findById(id).exec();
  if (!template) {
    throw new AppError("Plantilla no encontrada.", 404);
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
    filter["title"] = { $regex: escapeRegex(search), $options: "i" };
  }

  const [documents, total] = await Promise.all([
    SpecTemplate.find(filter).sort(sort).skip(skip).limit(limit).exec(),
    SpecTemplate.countDocuments(filter).exec(),
  ]);

  return { documents, meta: buildMeta(total, page, limit) };
}

async function create(input: SpecTemplateInput, actor: ActorContext): Promise<ISpecTemplate> {
  const title = input.title!;
  await assertTitleIsFree(title);

  const templateCount = await SpecTemplate.countDocuments().exec();
  if (templateCount >= MAX_SPEC_TEMPLATES) {
    throw new AppError(`No se pueden crear más de ${MAX_SPEC_TEMPLATES} plantillas.`, 400);
  }

  const template = await SpecTemplate.create({
    title,
    fields: (input.fields ?? []).map((field, index) => ({ label: field.label, order: field.order ?? index })),
    source: "manual",
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.spec_template_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(template._id),
    after: { title: template.title, fields: template.fields.length },
    ip: actor.ip,
  });

  return template;
}

async function update(id: string, input: SpecTemplateInput, actor: ActorContext): Promise<ISpecTemplate> {
  const template = await findByIdOrFail(id);
  const before = { title: template.title, fields: template.fields.length };

  if (input.title !== undefined && input.title !== template.title) {
    await assertTitleIsFree(input.title, id);
    template.title = input.title;
  }
  if (input.fields !== undefined) {
    template.fields = input.fields.map((field, index) => ({ label: field.label, order: field.order ?? index }));
  }
  if (input.order !== undefined) template.order = input.order;
  if (input.isActive !== undefined) template.isActive = input.isActive;

  await template.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.spec_template_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { title: template.title, fields: template.fields.length },
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
    action: "catalog.spec_template_deleted" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { title: template.title },
    ip: actor.ip,
  });
}

/**
 * Learns from a product's spec sheet after it's saved — never before: this
 * is memory, not validation, so it must never be able to block the write
 * that triggered it. Awaited by its callers, same discipline as
 * `recordAuditLog` — not fire-and-forget, so it's done by the time the
 * response goes out, but its own try/catch below means a failure here can
 * never fail a spec sheet that already saved successfully.
 *
 * For each group: an existing template with the same title (case-
 * insensitive) gets any new labels merged in, without ever losing a `manual`
 * template's curated status by re-deriving it as `auto`. A title that has
 * never been seen becomes a new `auto` template — unless the collection is
 * already at its cap, in which case learning silently no-ops rather than
 * blocking the product save the way a hard limit on a foreground write would.
 */
export async function learnSpecTemplates(groups: SpecGroup[]): Promise<void> {
  try {
    for (const group of groups) {
      const title = group.title.trim();
      if (!title) continue;

      const existing = await findByTitle(title);
      if (existing) {
        const knownLabels = new Set(existing.fields.map((field) => field.label.toLowerCase()));
        const newFields = group.fields
          .filter((field) => field.label.trim() && !knownLabels.has(field.label.trim().toLowerCase()))
          .map((field, index) => ({ label: field.label.trim(), order: existing.fields.length + index }));

        if (newFields.length > 0) {
          existing.fields = [...existing.fields, ...newFields].slice(0, 30);
          await existing.save();
        }
        continue;
      }

      const templateCount = await SpecTemplate.countDocuments().exec();
      if (templateCount >= MAX_SPEC_TEMPLATES) continue;

      await SpecTemplate.create({
        title,
        fields: group.fields
          .filter((field) => field.label.trim())
          .map((field, index) => ({ label: field.label.trim(), order: index })),
        source: "auto",
        order: templateCount,
      });
    }
  } catch (error) {
    logger.error({ err: error }, "[spec-template] Failed to learn spec templates from a product save");
  }
}

export const specTemplateService = { list, findByIdOrFail, create, update, remove };
